/**
 * Feature 5: Artist DNA Identity Model
 * 
 * Builds a unique artistic fingerprint from all of an artist's tracks.
 * Identifies harmonic tendencies, melodic contour preferences, rhythmic
 * patterns, production signatures, and emotional palette.
 * Uses Claude 4.5 to synthesize the identity model.
 */

import { invokeLLM } from "../_core/llm";
import * as db from "../db";

export interface ArtistDNAProfile {
  // Core identity
  artistArchetype: string; // e.g., "Atmospheric Storyteller", "Rhythmic Innovator"
  signatureDescription: string; // 2-3 sentence identity summary
  
  // Musical tendencies
  harmonicTendencies: {
    preferredKeys: string[];
    chordComplexity: "simple" | "moderate" | "complex" | "avant-garde";
    harmonicSignature: string;
  };
  melodicContour: {
    range: "narrow" | "moderate" | "wide";
    preferredMovement: "stepwise" | "leaping" | "mixed";
    contourSignature: string;
  };
  rhythmicProfile: {
    tempoRange: { min: number; max: number; preferred: number };
    grooveStyle: string;
    rhythmicSignature: string;
  };
  
  // Production identity
  productionFingerprint: {
    preferredInstruments: string[];
    soundPalette: string;
    spatialPreference: "intimate" | "wide" | "immersive" | "varied";
    dynamicRange: "compressed" | "moderate" | "dynamic" | "extreme";
    productionSignature: string;
  };
  
  // Emotional palette
  emotionalPalette: {
    dominantEmotions: string[];
    emotionalRange: "focused" | "moderate" | "broad";
    moodSignature: string;
  };
  
  // Genre positioning
  genreMap: {
    primaryGenre: string;
    secondaryGenres: string[];
    uniqueBlend: string;
  };
  
  // Evolution
  evolutionNotes: string;
  
  // Strengths and growth areas
  coreStrengths: string[];
  growthOpportunities: string[];
  
  // Metadata
  trackCount: number;
  confidence: "low" | "medium" | "high"; // Based on track count
}

/**
 * Generate an Artist DNA profile from all of a user's tracks and reviews.
 */
export async function generateArtistDNA(userId: number): Promise<ArtistDNAProfile> {
  // Gather all tracks and reviews for this user
  const allTracks = await db.getTracksByUser(userId);
  if (allTracks.length < 2) {
    throw new Error("Need at least 2 tracks to generate an Artist DNA profile");
  }

  // Get reviews for all tracks
  const trackData: Array<{
    title: string;
    genre: string;
    bpm?: number;
    key?: string;
    duration?: number;
    scores?: Record<string, number>;
    reviewExcerpt?: string;
  }> = [];

  for (const track of allTracks.slice(0, 20)) { // Cap at 20 tracks for context window
    const reviews = await db.getReviewsByTrack(track.id);
    const audioFeatures = await db.getAudioFeaturesByTrack(track.id);
    const geminiData = audioFeatures?.geminiAnalysisJson as Record<string, unknown> | null;
    const latestReview = reviews[0];

    trackData.push({
      title: track.originalFilename,
      genre: track.detectedGenre ?? "Unknown",
      bpm: (geminiData?.bpm as number) ?? undefined,
      key: (geminiData?.key as string) ?? undefined,
      duration: track.duration ?? undefined,
      scores: (latestReview?.scoresJson as Record<string, number>) ?? undefined,
      reviewExcerpt: latestReview?.reviewMarkdown?.slice(0, 200) ?? undefined,
    });
  }

  const confidence = allTracks.length >= 10 ? "high" : allTracks.length >= 5 ? "medium" : "low";

  const prompt = `You are a musicologist and artist development specialist. Analyze this artist's complete catalog to build their unique artistic DNA profile — their musical fingerprint.

CATALOG (${allTracks.length} tracks total, showing up to 20):
${trackData.map((t, i) => `
Track ${i + 1}: "${t.title}"
  Genre: ${t.genre}
  ${t.bpm ? `BPM: ${t.bpm}` : ""}
  ${t.key ? `Key: ${t.key}` : ""}
  ${t.duration ? `Duration: ${Math.round(t.duration)}s` : ""}
  ${t.scores ? `Scores: ${Object.entries(t.scores).map(([k, v]) => `${k}=${v}`).join(", ")}` : ""}
  ${t.reviewExcerpt ? `Review: ${t.reviewExcerpt}` : ""}
`).join("")}

Build a comprehensive Artist DNA profile that captures:
1. An archetype name (creative, evocative label like "Atmospheric Storyteller" or "Rhythmic Innovator")
2. Harmonic tendencies (preferred keys, chord complexity, signature)
3. Melodic contour (range, movement preference, signature)
4. Rhythmic profile (tempo range, groove style, signature)
5. Production fingerprint (instruments, sound palette, spatial preference, dynamics)
6. Emotional palette (dominant emotions, range, mood signature)
7. Genre positioning (primary, secondary, unique blend)
8. Evolution notes (how the artist is developing)
9. Core strengths and growth opportunities

Be specific and insightful. This should feel like a personalized artist development report.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a musicologist. Return JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "artist_dna",
          strict: true,
          schema: {
            type: "object",
            properties: {
              artistArchetype: { type: "string" },
              signatureDescription: { type: "string" },
              harmonicTendencies: {
                type: "object",
                properties: {
                  preferredKeys: { type: "array", items: { type: "string" } },
                  chordComplexity: { type: "string", enum: ["simple", "moderate", "complex", "avant-garde"] },
                  harmonicSignature: { type: "string" },
                },
                required: ["preferredKeys", "chordComplexity", "harmonicSignature"],
                additionalProperties: false,
              },
              melodicContour: {
                type: "object",
                properties: {
                  range: { type: "string", enum: ["narrow", "moderate", "wide"] },
                  preferredMovement: { type: "string", enum: ["stepwise", "leaping", "mixed"] },
                  contourSignature: { type: "string" },
                },
                required: ["range", "preferredMovement", "contourSignature"],
                additionalProperties: false,
              },
              rhythmicProfile: {
                type: "object",
                properties: {
                  tempoRange: {
                    type: "object",
                    properties: { min: { type: "number" }, max: { type: "number" }, preferred: { type: "number" } },
                    required: ["min", "max", "preferred"],
                    additionalProperties: false,
                  },
                  grooveStyle: { type: "string" },
                  rhythmicSignature: { type: "string" },
                },
                required: ["tempoRange", "grooveStyle", "rhythmicSignature"],
                additionalProperties: false,
              },
              productionFingerprint: {
                type: "object",
                properties: {
                  preferredInstruments: { type: "array", items: { type: "string" } },
                  soundPalette: { type: "string" },
                  spatialPreference: { type: "string", enum: ["intimate", "wide", "immersive", "varied"] },
                  dynamicRange: { type: "string", enum: ["compressed", "moderate", "dynamic", "extreme"] },
                  productionSignature: { type: "string" },
                },
                required: ["preferredInstruments", "soundPalette", "spatialPreference", "dynamicRange", "productionSignature"],
                additionalProperties: false,
              },
              emotionalPalette: {
                type: "object",
                properties: {
                  dominantEmotions: { type: "array", items: { type: "string" } },
                  emotionalRange: { type: "string", enum: ["focused", "moderate", "broad"] },
                  moodSignature: { type: "string" },
                },
                required: ["dominantEmotions", "emotionalRange", "moodSignature"],
                additionalProperties: false,
              },
              genreMap: {
                type: "object",
                properties: {
                  primaryGenre: { type: "string" },
                  secondaryGenres: { type: "array", items: { type: "string" } },
                  uniqueBlend: { type: "string" },
                },
                required: ["primaryGenre", "secondaryGenres", "uniqueBlend"],
                additionalProperties: false,
              },
              evolutionNotes: { type: "string" },
              coreStrengths: { type: "array", items: { type: "string" } },
              growthOpportunities: { type: "array", items: { type: "string" } },
            },
            required: ["artistArchetype", "signatureDescription", "harmonicTendencies", "melodicContour", "rhythmicProfile", "productionFingerprint", "emotionalPalette", "genreMap", "evolutionNotes", "coreStrengths", "growthOpportunities"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : "";
    if (!content) throw new Error("Empty LLM response");
    const dna = JSON.parse(content);

    const profile: ArtistDNAProfile = {
      ...dna,
      trackCount: allTracks.length,
      confidence,
    };

    // Persist to DB
    await db.saveArtistDNA({
      userId,
      dnaJson: profile as unknown as Record<string, unknown>,
      trackCount: allTracks.length,
    });

    return profile;
  } catch (error) {
    console.error("[ArtistDNA] Generation failed:", error);
    throw new Error("Failed to generate Artist DNA profile. Please try again.");
  }
}

/**
 * Get the latest Artist DNA profile for a user.
 */
export async function getLatestDNA(userId: number): Promise<ArtistDNAProfile | null> {
  const row = await db.getLatestArtistDNA(userId);
  if (!row) return null;
  return row.dnaJson as unknown as ArtistDNAProfile;
}

/**
 * Get DNA history for a user.
 */
export async function getDNAHistory(userId: number) {
  const rows = await db.getArtistDNAHistory(userId);
  return rows.map(r => ({
    id: r.id,
    trackCount: r.trackCount,
    generatedAt: r.generatedAt,
    archetype: (r.dnaJson as Record<string, unknown>).artistArchetype as string,
    confidence: (r.dnaJson as Record<string, unknown>).confidence as string,
  }));
}
