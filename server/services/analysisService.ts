/**
 * Analysis Service — generates Mix Reports, Structure Analysis, Genre Benchmarks,
 * DAW Session Notes, and Mood/Energy data using Claude via Forge API.
 * 
 * These are "second-pass" analyses that run on top of the existing Gemini audio
 * analysis and Claude review data already stored in the database.
 */
import { callClaude } from "./claudeCritic";
import type { GeminiAudioAnalysis } from "./geminiAudio";

// ── Mix Feedback Report (Feature 3) ──

export interface MixReportData {
  reportMarkdown: string;
  frequencyAnalysis: {
    lowEnd: { rating: string; notes: string };
    midRange: { rating: string; notes: string };
    highEnd: { rating: string; notes: string };
    overallBalance: string;
  };
  dynamicsAnalysis: {
    dynamicRange: string;
    compression: string;
    transients: string;
    loudness: string;
  };
  stereoAnalysis: {
    width: string;
    balance: string;
    monoCompatibility: string;
    panningNotes: string;
  };
  loudnessData: {
    estimatedLUFS: number;
    targetLUFS: number;
    genre: string;
    recommendation: string;
  };
  dawSuggestions: Array<{
    timestamp: string;
    element: string;
    issue: string;
    suggestion: string;
    priority: "high" | "medium" | "low";
  }>;
}

export async function generateMixReport(
  audioAnalysis: GeminiAudioAnalysis,
  trackTitle: string,
  genre: string,
  existingReview?: string,
): Promise<MixReportData> {
  const systemPrompt = `You are a world-class mixing and mastering engineer with 20+ years of experience. You provide detailed, technical mix feedback that producers can immediately act on in their DAW. You speak in precise technical terms but explain concepts clearly. You always reference specific frequencies, dB levels, and timestamps.`;

  const userMessage = `Analyze this track's mix and provide a comprehensive technical mix report.

**Track:** "${trackTitle}"
**Genre:** ${genre}

## Audio Analysis Data
- **Mix Quality:** ${audioAnalysis.production.mixQuality}
- **Frequency Balance:** ${audioAnalysis.production.frequencyBalance}
- **Spatial Characteristics:** ${audioAnalysis.production.spatialCharacteristics}
- **Dynamic Processing:** ${audioAnalysis.production.dynamicProcessing}
- **Notable Effects:** ${audioAnalysis.production.notableEffects?.join(", ") || "None noted"}
- **Dynamic Range:** ${audioAnalysis.energy.dynamicRange}
- **Tempo:** ${audioAnalysis.tempo.bpm} BPM
- **Key:** ${audioAnalysis.key.estimated}
- **Instrumentation:** ${audioAnalysis.instrumentation?.join(", ") || "Unknown"}
- **Arrangement Density:** ${audioAnalysis.arrangement.density}
- **Arrangement Layering:** ${audioAnalysis.arrangement.layering}

## Energy Curve
${audioAnalysis.energy.curve?.map(e => `${e.timestamp}: Level ${e.level}/10 — ${e.description}`).join("\n") || "No curve data"}

## Sections
${audioAnalysis.sections?.map(s => `${s.name} (${s.startTime}-${s.endTime}): Energy ${s.energy}/10 — ${s.description}`).join("\n") || "No section data"}

${existingReview ? `## Existing Review Context\n${existingReview.substring(0, 2000)}` : ""}

Return your analysis as a JSON object with this exact structure:
{
  "reportMarkdown": "A detailed 1000-2000 word mix report in markdown format with sections: ## Overview, ## Frequency Analysis, ## Dynamics & Loudness, ## Stereo Image & Spatial, ## Section-by-Section Notes, ## Priority Action Items, ## Mastering Readiness",
  "frequencyAnalysis": {
    "lowEnd": { "rating": "weak|adequate|good|excellent", "notes": "specific feedback about sub-bass and bass (20-250Hz)" },
    "midRange": { "rating": "weak|adequate|good|excellent", "notes": "specific feedback about mids (250Hz-4kHz)" },
    "highEnd": { "rating": "weak|adequate|good|excellent", "notes": "specific feedback about highs (4kHz-20kHz)" },
    "overallBalance": "summary of frequency balance"
  },
  "dynamicsAnalysis": {
    "dynamicRange": "compressed|moderate|wide|very wide",
    "compression": "notes on compression usage",
    "transients": "notes on transient handling",
    "loudness": "notes on perceived loudness"
  },
  "stereoAnalysis": {
    "width": "narrow|moderate|wide|very wide",
    "balance": "notes on L/R balance",
    "monoCompatibility": "good|fair|poor — with explanation",
    "panningNotes": "notes on panning decisions"
  },
  "loudnessData": {
    "estimatedLUFS": <estimated integrated LUFS as number>,
    "targetLUFS": <recommended target LUFS for this genre>,
    "genre": "${genre}",
    "recommendation": "specific loudness recommendation"
  },
  "dawSuggestions": [
    {
      "timestamp": "M:SS or section name",
      "element": "specific element (e.g., 'kick drum', 'vocal', 'synth pad')",
      "issue": "what's wrong",
      "suggestion": "specific DAW action to fix it (e.g., 'Cut 2dB at 400Hz on the kick bus')",
      "priority": "high|medium|low"
    }
  ]
}

Provide at least 8-12 DAW suggestions. Be specific with frequencies, dB values, and plugin recommendations where appropriate.`;

  const response = await callClaude(systemPrompt, [{ role: "user", content: userMessage }], 6000);
  
  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // If JSON parsing fails, wrap the raw response
    return {
      reportMarkdown: response,
      frequencyAnalysis: { lowEnd: { rating: "adequate", notes: "" }, midRange: { rating: "adequate", notes: "" }, highEnd: { rating: "adequate", notes: "" }, overallBalance: "" },
      dynamicsAnalysis: { dynamicRange: "moderate", compression: "", transients: "", loudness: "" },
      stereoAnalysis: { width: "moderate", balance: "", monoCompatibility: "fair", panningNotes: "" },
      loudnessData: { estimatedLUFS: -14, targetLUFS: -14, genre, recommendation: "" },
      dawSuggestions: [],
    };
  }
}

// ── Songwriting Structure Analysis (Feature 7) ──

export interface StructureAnalysisData {
  sections: Array<{
    name: string;
    startTime: string;
    endTime: string;
    durationSeconds: number;
    percentOfTotal: number;
    energy: number;
    role: string;
  }>;
  structureScore: number;
  genreExpectations: {
    genre: string;
    typicalStructure: string;
    expectedChorusArrival: string;
    expectedSongLength: string;
    structureNotes: string;
  };
  suggestions: Array<{
    section: string;
    issue: string;
    suggestion: string;
    impact: "high" | "medium" | "low";
  }>;
}

export async function generateStructureAnalysis(
  audioAnalysis: GeminiAudioAnalysis,
  trackTitle: string,
  genre: string,
  lyrics?: string,
): Promise<StructureAnalysisData> {
  const systemPrompt = `You are an expert songwriter and music arranger who specializes in song structure analysis. You understand how structure affects listener engagement, commercial viability, and emotional impact. You reference genre conventions and successful examples.`;

  const userMessage = `Analyze the song structure of this track and provide detailed structural feedback.

**Track:** "${trackTitle}"
**Genre:** ${genre}
**Duration:** ~${audioAnalysis.estimatedDuration}s
**Tempo:** ${audioAnalysis.tempo.bpm} BPM

## Detected Sections
${audioAnalysis.sections?.map(s => `- **${s.name}** (${s.startTime}–${s.endTime}): Energy ${s.energy}/10 — ${s.description}\n  Elements: ${s.musicalElements?.join(", ") || "N/A"}`).join("\n") || "No sections detected"}

## Arrangement Info
- Density: ${audioAnalysis.arrangement.density}
- Layering: ${audioAnalysis.arrangement.layering}
- Transitions: ${audioAnalysis.arrangement.transitions}
- Build & Release: ${audioAnalysis.arrangement.buildAndRelease}

## Hook/Melody
- Hook Strength: ${audioAnalysis.melodicAnalysis.hookStrength}
- Memorability: ${audioAnalysis.melodicAnalysis.memorability}

${lyrics ? `## Lyrics\n${lyrics.substring(0, 2000)}` : ""}

Return a JSON object:
{
  "sections": [
    {
      "name": "section name",
      "startTime": "M:SS",
      "endTime": "M:SS",
      "durationSeconds": <number>,
      "percentOfTotal": <number 0-100>,
      "energy": <1-10>,
      "role": "brief description of this section's role in the song arc"
    }
  ],
  "structureScore": <1-10 rating of how effective the structure is>,
  "genreExpectations": {
    "genre": "${genre}",
    "typicalStructure": "describe the typical structure for this genre",
    "expectedChorusArrival": "when listeners expect the chorus/hook in this genre",
    "expectedSongLength": "typical song length for this genre",
    "structureNotes": "how this track's structure compares to genre norms"
  },
  "suggestions": [
    {
      "section": "which section this applies to",
      "issue": "what the structural issue is",
      "suggestion": "specific actionable suggestion",
      "impact": "high|medium|low"
    }
  ]
}

Be specific. Reference the actual timestamps and sections. Provide at least 4-6 suggestions.`;

  const response = await callClaude(systemPrompt, [{ role: "user", content: userMessage }], 4000);
  
  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      sections: audioAnalysis.sections?.map(s => ({
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        durationSeconds: 0,
        percentOfTotal: 0,
        energy: s.energy,
        role: s.description,
      })) || [],
      structureScore: 5,
      genreExpectations: { genre, typicalStructure: "", expectedChorusArrival: "", expectedSongLength: "", structureNotes: "" },
      suggestions: [],
    };
  }
}

// ── DAW Session Notes Export (Feature 6) ──

export interface DAWSessionNotes {
  title: string;
  generatedAt: string;
  trackInfo: {
    title: string;
    genre: string;
    tempo: number;
    key: string;
    duration: string;
  };
  sections: Array<{
    name: string;
    timeRange: string;
    notes: string[];
  }>;
  mixNotes: string[];
  arrangementNotes: string[];
  priorityActions: Array<{
    priority: number;
    action: string;
    section: string;
  }>;
}

export async function generateDAWSessionNotes(
  audioAnalysis: GeminiAudioAnalysis,
  trackTitle: string,
  genre: string,
  reviewMarkdown?: string,
  mixReportMarkdown?: string,
): Promise<DAWSessionNotes> {
  const systemPrompt = `You are a session engineer preparing notes for a producer to use in their DAW. Write concise, actionable notes organized by section. Use technical language but keep it practical. Format everything as if it will be printed and placed next to the DAW screen.`;

  const userMessage = `Generate DAW session notes for this track.

**Track:** "${trackTitle}"
**Genre:** ${genre}
**Tempo:** ${audioAnalysis.tempo.bpm} BPM (${audioAnalysis.tempo.feel})
**Key:** ${audioAnalysis.key.estimated}
**Duration:** ~${audioAnalysis.estimatedDuration}s

## Sections
${audioAnalysis.sections?.map(s => `- ${s.name} (${s.startTime}–${s.endTime}): ${s.description}`).join("\n") || "No sections"}

## Production Notes
- Mix: ${audioAnalysis.production.mixQuality}
- Frequency Balance: ${audioAnalysis.production.frequencyBalance}
- Dynamics: ${audioAnalysis.production.dynamicProcessing}
- Effects: ${audioAnalysis.production.notableEffects?.join(", ") || "None"}

${reviewMarkdown ? `## Review Excerpts\n${reviewMarkdown.substring(0, 2000)}` : ""}
${mixReportMarkdown ? `## Mix Report Excerpts\n${mixReportMarkdown.substring(0, 2000)}` : ""}

Return a JSON object:
{
  "title": "Session Notes: ${trackTitle}",
  "generatedAt": "${new Date().toISOString()}",
  "trackInfo": {
    "title": "${trackTitle}",
    "genre": "${genre}",
    "tempo": ${audioAnalysis.tempo.bpm},
    "key": "${audioAnalysis.key.estimated}",
    "duration": "M:SS format"
  },
  "sections": [
    {
      "name": "section name",
      "timeRange": "M:SS – M:SS",
      "notes": ["actionable note 1", "actionable note 2"]
    }
  ],
  "mixNotes": ["global mix note 1", "global mix note 2"],
  "arrangementNotes": ["arrangement suggestion 1", "arrangement suggestion 2"],
  "priorityActions": [
    { "priority": 1, "action": "most important thing to do", "section": "which section" }
  ]
}

Keep notes concise and actionable. Prioritize the top 5-10 things the producer should do.`;

  const response = await callClaude(systemPrompt, [{ role: "user", content: userMessage }], 4000);
  
  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      title: `Session Notes: ${trackTitle}`,
      generatedAt: new Date().toISOString(),
      trackInfo: { title: trackTitle, genre, tempo: audioAnalysis.tempo.bpm, key: audioAnalysis.key.estimated, duration: `${Math.floor(audioAnalysis.estimatedDuration / 60)}:${String(audioAnalysis.estimatedDuration % 60).padStart(2, "0")}` },
      sections: [],
      mixNotes: [],
      arrangementNotes: [],
      priorityActions: [],
    };
  }
}

// ── Genre Benchmark Aggregation (Feature 5) ──

export interface GenreBenchmark {
  genre: string;
  trackCount: number;
  averageScores: Record<string, number>;
  scoreDistribution: Record<string, { min: number; max: number; median: number }>;
  topStrengths: string[];
  commonWeaknesses: string[];
}

export function aggregateGenreBenchmarks(
  genre: string,
  trackCount: number,
  reviewScores: Array<Record<string, number>>,
): GenreBenchmark {
  if (reviewScores.length === 0) {
    return {
      genre,
      trackCount,
      averageScores: {},
      scoreDistribution: {},
      topStrengths: [],
      commonWeaknesses: [],
    };
  }

  // Collect all score keys
  const allKeys = new Set<string>();
  reviewScores.forEach(s => Object.keys(s).forEach(k => allKeys.add(k)));

  const averageScores: Record<string, number> = {};
  const scoreDistribution: Record<string, { min: number; max: number; median: number }> = {};

  for (const key of Array.from(allKeys)) {
    const values = reviewScores.map(s => s[key]).filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b);
    if (values.length === 0) continue;
    averageScores[key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    scoreDistribution[key] = {
      min: values[0],
      max: values[values.length - 1],
      median: values[Math.floor(values.length / 2)],
    };
  }

  // Identify strengths (highest avg) and weaknesses (lowest avg)
  const sorted = Object.entries(averageScores).sort((a, b) => b[1] - a[1]);
  const topStrengths = sorted.slice(0, 3).map(([k, v]) => `${k}: ${v}/10`);
  const commonWeaknesses = sorted.slice(-3).reverse().map(([k, v]) => `${k}: ${v}/10`);

  return { genre, trackCount, averageScores, scoreDistribution, topStrengths, commonWeaknesses };
}
