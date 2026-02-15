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

  const analysisContext = `**Track:** "${trackTitle}"
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

${existingReview ? `## Existing Review Context\n${existingReview.substring(0, 2000)}` : ""}`;

  // Step 1: Get the detailed markdown report
  const markdownPrompt = `Analyze this track's mix and write a comprehensive technical mix report in markdown format.

${analysisContext}

Write a detailed 600-1000 word mix report with these sections:
## Overview (2-3 sentences)
## Frequency Analysis (Low End, Mid Range, High End subsections. 2-3 sentences per sub.)
## Dynamics & Loudness (2-3 sentences)
## Stereo Image & Spatial (2-3 sentences)
## Section-by-Section Notes (Reference specific timestamps. 3-4 paragraphs, 2-3 sentences each.)
## Priority Action Items (Numbered list of 5-8 specific DAW actions.)
## Mastering Readiness (1-2 sentences)

Return ONLY the markdown text, no JSON wrapping.`;

  const reportMarkdown = await callClaude(systemPrompt, [{ role: "user", content: markdownPrompt }], 4000);

  // Step 2: Get structured data as a separate call
  const structuredPrompt = `Based on this audio analysis data, provide structured mix feedback data.

${analysisContext}

Return ONLY a valid JSON object (no markdown fences, no explanation) with this exact structure:
{
  "frequencyAnalysis": {
    "lowEnd": { "rating": "weak|adequate|good|excellent", "notes": "1-2 sentence feedback about sub-bass and bass (20-250Hz)" },
    "midRange": { "rating": "weak|adequate|good|excellent", "notes": "1-2 sentence feedback about mids (250Hz-4kHz)" },
    "highEnd": { "rating": "weak|adequate|good|excellent", "notes": "1-2 sentence feedback about highs (4kHz-20kHz)" },
    "overallBalance": "1 sentence summary"
  },
  "dynamicsAnalysis": {
    "dynamicRange": "compressed|moderate|wide|very wide",
    "compression": "1-2 sentences",
    "transients": "1-2 sentences",
    "loudness": "1-2 sentences"
  },
  "stereoAnalysis": {
    "width": "narrow|moderate|wide|very wide",
    "balance": "1-2 sentences",
    "monoCompatibility": "good|fair|poor",
    "panningNotes": "1-2 sentences"
  },
  "loudnessData": {
    "estimatedLUFS": -14,
    "targetLUFS": -14,
    "genre": "${genre}",
    "recommendation": "1-2 sentences"
  },
  "dawSuggestions": [
    { "timestamp": "M:SS", "element": "instrument", "issue": "problem", "suggestion": "fix", "priority": "high|medium|low" }
  ]
}

Provide 5-8 dawSuggestions. Keep all string values short (under 150 chars). Return ONLY the JSON.`;

  const structuredResponse = await callClaude(systemPrompt, [{ role: "user", content: structuredPrompt }], 3000);

  // Parse the structured data
  let structured: Omit<MixReportData, "reportMarkdown">;
  try {
    const cleaned = structuredResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    structured = JSON.parse(cleaned);
  } catch (err) {
    console.warn("[MixReport] Could not parse structured data, using defaults:", err);
    structured = {
      frequencyAnalysis: { lowEnd: { rating: "adequate", notes: "See full report" }, midRange: { rating: "adequate", notes: "See full report" }, highEnd: { rating: "adequate", notes: "See full report" }, overallBalance: "See full report for details" },
      dynamicsAnalysis: { dynamicRange: "moderate", compression: "See full report", transients: "See full report", loudness: "See full report" },
      stereoAnalysis: { width: "moderate", balance: "See full report", monoCompatibility: "fair", panningNotes: "See full report" },
      loudnessData: { estimatedLUFS: -14, targetLUFS: -14, genre, recommendation: "See full report" },
      dawSuggestions: [],
    };
  }

  // Clean the markdown (remove any code fences the LLM may have wrapped it in)
  const cleanedMarkdown = reportMarkdown.replace(/^```markdown\n?/g, "").replace(/```$/g, "").trim();

  return {
    reportMarkdown: cleanedMarkdown,
    ...structured,
  };
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

Be specific. Reference actual timestamps and sections. Provide 3-5 suggestions. Keep all string values concise (under 150 chars).`;

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

Keep notes concise and actionable. Prioritize the top 5-8 things the producer should do. Max 2-3 notes per section.`;

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


// ── Project Insights Summary (Feature 1 — Round 40) ──

export interface ProjectInsightsData {
  summaryMarkdown: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  averageScores: Record<string, number>;
}

export async function generateProjectInsights(
  projectTitle: string,
  trackData: Array<{
    filename: string;
    genre: string | null;
    quickTake: string | null;
    scores: Record<string, number>;
    reviewExcerpt: string;
  }>,
): Promise<ProjectInsightsData> {
  const systemPrompt = `You are a senior A&R executive and music consultant providing a high-level project assessment. You synthesize individual track reviews into actionable project-level insights. Be specific, constructive, and reference individual tracks by name when making points. Keep your analysis concise but insightful.`;

  // Compute average scores across all tracks
  const allKeys = new Set<string>();
  for (const t of trackData) {
    for (const k of Object.keys(t.scores)) allKeys.add(k);
  }
  const averageScores: Record<string, number> = {};
  for (const key of Array.from(allKeys)) {
    const vals = trackData.map(t => t.scores[key]).filter(v => typeof v === "number" && !isNaN(v));
    if (vals.length > 0) {
      averageScores[key] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
  }

  const trackSummaries = trackData.map((t, i) => {
    const scoreStr = Object.entries(t.scores).map(([k, v]) => `${k}: ${v}/10`).join(", ");
    return `### Track ${i + 1}: "${t.filename}"
- **Genre:** ${t.genre || "Unknown"}
- **Quick Take:** ${t.quickTake || "N/A"}
- **Scores:** ${scoreStr}
- **Review Excerpt:** ${t.reviewExcerpt.slice(0, 500)}`;
  }).join("\n\n");

  const avgStr = Object.entries(averageScores).map(([k, v]) => `${k}: ${v}/10`).join(", ");

  const userPrompt = `Analyze this project and provide a concise executive summary.

**Project:** "${projectTitle}"
**Tracks:** ${trackData.length}
**Average Scores:** ${avgStr}

${trackSummaries}

Respond in this exact JSON format:
{
  "summary": "A 2-3 paragraph markdown summary of the project's overall quality, artistic direction, and commercial potential. Reference specific tracks.",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}

Keep strengths/weaknesses/recommendations to 3-5 items each, each one sentence. The summary should be 150-250 words.`;

  const raw = await callClaude(systemPrompt, [{ role: "user", content: userPrompt }], 2048);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summaryMarkdown: parsed.summary || "No summary generated.",
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      recommendations: parsed.recommendations || [],
      averageScores,
    };
  } catch {
    // Fallback: use the raw text as summary
    return {
      summaryMarkdown: raw,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      averageScores,
    };
  }
}
