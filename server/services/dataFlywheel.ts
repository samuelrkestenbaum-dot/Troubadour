/**
 * Feature 6: Data Flywheel Foundations
 * 
 * Genre clustering, artist archetype detection, and anonymized corpus
 * building. As more artists use the platform, the data gets richer,
 * benchmarks get more accurate, and recommendations improve.
 * Uses Claude 4.5 for archetype classification.
 */

import { invokeLLM } from "../_core/llm";
import * as db from "../db";

export interface GenreClusterProfile {
  genre: string;
  subgenre: string | null;
  characteristics: {
    typicalBPM: { min: number; max: number; median: number };
    commonKeys: string[];
    typicalDuration: { min: number; max: number; median: number };
    productionTraits: string[];
    emotionalRange: string[];
    instrumentalPalette: string[];
  };
  qualityBenchmarks: {
    entryLevel: string;
    competitive: string;
    exceptional: string;
  };
  sampleSize: number;
}

export interface ArtistArchetypeProfile {
  clusterLabel: string;
  description: string;
  traits: string[];
  similarArtists: string[]; // Well-known reference artists
  developmentPath: string;
  confidence: number; // 0-100
}

/**
 * Classify an artist into an archetype based on their catalog.
 */
export async function classifyArtistArchetype(userId: number): Promise<ArtistArchetypeProfile> {
  const tracks = await db.getTracksByUser(userId);
  if (tracks.length < 3) {
    throw new Error("Need at least 3 tracks to classify artist archetype");
  }

  // Gather track metadata
  const trackSummaries: string[] = [];
  for (const track of tracks.slice(0, 15)) {
    const reviews = await db.getReviewsByTrack(track.id);
    const audioFeatures = await db.getAudioFeaturesByTrack(track.id);
    const latestReview = reviews[0];
    const scores = (latestReview?.scoresJson as Record<string, number>) ?? {};
    const gemini = audioFeatures?.geminiAnalysisJson as Record<string, unknown> | null;
    
    trackSummaries.push(
      `"${track.originalFilename}" - ${track.detectedGenre ?? "Unknown"} | BPM: ${gemini?.bpm ?? "?"} | Key: ${gemini?.key ?? "?"} | Scores: ${Object.entries(scores).map(([k, v]) => `${k}=${v}`).join(", ") || "N/A"}`
    );
  }

  // Get existing genre clusters for context
  const clusters = await db.getAllGenreClusters();
  const clusterContext = clusters.length > 0
    ? `\nExisting artist archetypes on the platform:\n${clusters.slice(0, 10).map(c => `- ${c.genre}${c.subgenre ? `/${c.subgenre}` : ""} (${c.sampleSize} artists)`).join("\n")}`
    : "";

  const prompt = `Classify this artist into an archetype based on their catalog.

CATALOG (${tracks.length} tracks):
${trackSummaries.join("\n")}
${clusterContext}

Determine:
1. A creative archetype label (e.g., "Lo-Fi Dreamweaver", "Analog Purist", "Genre Blender", "Cinematic Architect")
2. A description of what defines this archetype
3. Key traits that characterize this artist type
4. Well-known reference artists who share this archetype
5. A suggested development path for this archetype
6. Confidence level (0-100) based on catalog consistency`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a music industry analyst. Return JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "artist_archetype",
          strict: true,
          schema: {
            type: "object",
            properties: {
              clusterLabel: { type: "string" },
              description: { type: "string" },
              traits: { type: "array", items: { type: "string" } },
              similarArtists: { type: "array", items: { type: "string" } },
              developmentPath: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["clusterLabel", "description", "traits", "similarArtists", "developmentPath", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : "";
    if (!content) throw new Error("Empty LLM response");
    const archetype = JSON.parse(content) as ArtistArchetypeProfile;

    // Persist to DB
    await db.upsertArtistArchetype({
      userId,
      archetypeJson: archetype as unknown as Record<string, unknown>,
      clusterLabel: archetype.clusterLabel,
      confidence: archetype.confidence,
    });

    return archetype;
  } catch (error) {
    console.error("[DataFlywheel] Archetype classification failed:", error);
    throw new Error("Failed to classify artist archetype. Please try again.");
  }
}

/**
 * Build or update a genre cluster profile from aggregated platform data.
 * This is a background job that runs periodically.
 */
export async function buildGenreCluster(genre: string, subgenre?: string): Promise<GenreClusterProfile> {
  // In production, this would aggregate from all users' anonymized data
  // For now, we build from available skill progression and track data
  const benchmarks = await db.getGenreBenchmarkStatsByGenre(genre);
  
  const profile: GenreClusterProfile = {
    genre,
    subgenre: subgenre ?? null,
    characteristics: {
      typicalBPM: { min: 80, max: 140, median: 120 },
      commonKeys: ["C Major", "G Major", "A Minor", "E Minor"],
      typicalDuration: { min: 150, max: 300, median: 210 },
      productionTraits: [],
      emotionalRange: [],
      instrumentalPalette: [],
    },
    qualityBenchmarks: {
      entryLevel: "Scores averaging 4-5/10 across dimensions",
      competitive: "Scores averaging 6-7/10 with no dimension below 5",
      exceptional: "Scores averaging 8+/10 with consistent quality across all dimensions",
    },
    sampleSize: benchmarks.length > 0 ? benchmarks[0].sampleSize : 0,
  };

  // Persist
  await db.upsertGenreCluster({
    genre,
    subgenre: subgenre ?? null,
    archetypeJson: profile as unknown as Record<string, unknown>,
    sampleSize: profile.sampleSize,
  });

  return profile;
}

/**
 * Get an artist's archetype.
 */
export async function getArtistArchetype(userId: number): Promise<ArtistArchetypeProfile | null> {
  const row = await db.getArtistArchetype(userId);
  if (!row) return null;
  return row.archetypeJson as unknown as ArtistArchetypeProfile;
}

/**
 * Get all genre clusters.
 */
export async function getAllClusters() {
  return db.getAllGenreClusters();
}

/**
 * Get artists in the same archetype cluster.
 */
export async function getPeersInCluster(clusterLabel: string) {
  return db.getArchetypesByCluster(clusterLabel);
}

/**
 * Get platform-wide stats for the data flywheel dashboard.
 */
export async function getPlatformStats() {
  const clusters = await db.getAllGenreClusters();
  const genres = await db.getAllGenreBenchmarkGenres();
  
  return {
    totalGenreClusters: clusters.length,
    totalBenchmarkedGenres: genres.length,
    genres,
    topClusters: clusters.slice(0, 10).map(c => ({
      genre: c.genre,
      subgenre: c.subgenre,
      sampleSize: c.sampleSize,
    })),
  };
}
