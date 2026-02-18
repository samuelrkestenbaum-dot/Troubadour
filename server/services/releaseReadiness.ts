/**
 * Feature 3: Release Readiness Scoring
 * 
 * Green/Yellow/Red traffic light system that evaluates whether a track
 * is ready for release. Uses Claude 4.5 to synthesize all available data
 * (review scores, mix report, structure analysis, mastering checklist)
 * into a clear go/no-go signal with specific blockers.
 */

import { invokeLLM } from "../_core/llm";
import * as db from "../db";

export interface ReleaseReadinessResult {
  overallSignal: "green" | "yellow" | "red";
  overallScore: number; // 0-100
  dimensionSignals: Record<string, { signal: "green" | "yellow" | "red"; score: number; reason: string }>;
  blockers: Array<{ dimension: string; severity: "critical" | "major" | "minor"; description: string; fix: string }>;
  strengths: Array<{ dimension: string; description: string }>;
  readinessStatement: string;
  estimatedEffort: string;
}

/**
 * Evaluate release readiness for a track by synthesizing all available data.
 */
export async function evaluateReleaseReadiness(params: {
  trackId: number;
  userId: number;
}): Promise<ReleaseReadinessResult> {
  const { trackId, userId } = params;

  const track = await db.getTrackById(trackId);
  if (!track) throw new Error("Track not found");

  const reviews = await db.getReviewsByTrack(trackId);
  const mixReport = await db.getMixReportByTrack(trackId);
  const structureAnalysis = await db.getStructureAnalysis(trackId);
  const masteringChecklist = await db.getMasteringChecklistByTrack(trackId);
  const audioFeatures = await db.getAudioFeaturesByTrack(trackId);

  const contextParts: string[] = [];

  if (reviews.length > 0) {
    const latestReview = reviews[0];
    const scores = latestReview.scoresJson as Record<string, number> | null;
    contextParts.push(`REVIEW SCORES:\n${scores ? Object.entries(scores).map(([k, v]) => `  ${k}: ${v}/10`).join("\n") : "No dimension scores"}`);
    contextParts.push(`REVIEW SUMMARY: ${latestReview.reviewMarkdown?.slice(0, 500) ?? "N/A"}`);
  }

  if (mixReport) {
    contextParts.push(`MIX REPORT: ${mixReport.reportMarkdown?.slice(0, 500) ?? "N/A"}`);
    if (mixReport.frequencyAnalysis) contextParts.push(`FREQUENCY: ${JSON.stringify(mixReport.frequencyAnalysis).slice(0, 300)}`);
    if (mixReport.loudnessData) contextParts.push(`LOUDNESS: ${JSON.stringify(mixReport.loudnessData).slice(0, 300)}`);
  }

  if (structureAnalysis) {
    contextParts.push(`STRUCTURE SCORE: ${structureAnalysis.structureScore ?? "N/A"}/100`);
    if (structureAnalysis.suggestions) contextParts.push(`STRUCTURE SUGGESTIONS: ${JSON.stringify(structureAnalysis.suggestions).slice(0, 300)}`);
  }

  if (masteringChecklist) {
    contextParts.push(`MASTERING READINESS: ${masteringChecklist.overallReadiness}%`);
    const items = masteringChecklist.itemsJson;
    if (items && Array.isArray(items)) {
      const incomplete = items.filter((i: any) => !i.completed);
      if (incomplete.length > 0) {
        contextParts.push(`MASTERING ISSUES: ${incomplete.map((i: any) => `[${i.priority}] ${i.issue}`).join("; ")}`);
      }
    }
  }

  if (audioFeatures?.geminiAnalysisJson) {
    const gemini = audioFeatures.geminiAnalysisJson as any;
    contextParts.push(`AUDIO: BPM=${gemini.bpm ?? "?"}, Key=${gemini.key ?? "?"}, Genre=${track.detectedGenre ?? "Unknown"}`);
  }

  if (contextParts.length === 0) {
    return {
      overallSignal: "red",
      overallScore: 0,
      dimensionSignals: {},
      blockers: [{ dimension: "data", severity: "critical", description: "No review or analysis data available", fix: "Generate a review first before checking release readiness" }],
      strengths: [],
      readinessStatement: "Cannot evaluate release readiness without review data. Generate a review first.",
      estimatedEffort: "Generate a review to begin evaluation",
    };
  }

  const prompt = `You are a senior A&R executive and mastering engineer evaluating whether a track is ready for commercial release.

TRACK: "${track.originalFilename}"
Genre: ${track.detectedGenre ?? "Unknown"}

${contextParts.join("\n\n")}

Evaluate this track's release readiness across these dimensions:
- Production Quality (mix clarity, sound design, arrangement)
- Song Structure (flow, transitions, length appropriateness)
- Performance (vocal/instrumental quality, timing, expression)
- Technical Standards (loudness, frequency balance, format readiness)
- Commercial Viability (hook strength, genre fit, market readiness)

For each dimension, assign:
- A signal: "green" (release-ready), "yellow" (minor issues), or "red" (needs work)
- A score: 0-100
- A reason explaining the signal

Identify specific blockers (things that MUST be fixed before release) and strengths.
Provide an overall signal, score, readiness statement, and estimated effort to fix any issues.

Be honest and specific. A "green" overall signal means the track can be released as-is.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a senior A&R executive. Return JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "release_readiness",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallSignal: { type: "string", enum: ["green", "yellow", "red"] },
              overallScore: { type: "number" },
              dimensionSignals: {
                type: "object",
                properties: {
                  productionQuality: { type: "object", properties: { signal: { type: "string" }, score: { type: "number" }, reason: { type: "string" } }, required: ["signal", "score", "reason"], additionalProperties: false },
                  songStructure: { type: "object", properties: { signal: { type: "string" }, score: { type: "number" }, reason: { type: "string" } }, required: ["signal", "score", "reason"], additionalProperties: false },
                  performance: { type: "object", properties: { signal: { type: "string" }, score: { type: "number" }, reason: { type: "string" } }, required: ["signal", "score", "reason"], additionalProperties: false },
                  technicalStandards: { type: "object", properties: { signal: { type: "string" }, score: { type: "number" }, reason: { type: "string" } }, required: ["signal", "score", "reason"], additionalProperties: false },
                  commercialViability: { type: "object", properties: { signal: { type: "string" }, score: { type: "number" }, reason: { type: "string" } }, required: ["signal", "score", "reason"], additionalProperties: false },
                },
                required: ["productionQuality", "songStructure", "performance", "technicalStandards", "commercialViability"],
                additionalProperties: false,
              },
              blockers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dimension: { type: "string" },
                    severity: { type: "string", enum: ["critical", "major", "minor"] },
                    description: { type: "string" },
                    fix: { type: "string" },
                  },
                  required: ["dimension", "severity", "description", "fix"],
                  additionalProperties: false,
                },
              },
              strengths: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dimension: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["dimension", "description"],
                  additionalProperties: false,
                },
              },
              readinessStatement: { type: "string" },
              estimatedEffort: { type: "string" },
            },
            required: ["overallSignal", "overallScore", "dimensionSignals", "blockers", "strengths", "readinessStatement", "estimatedEffort"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");
    const result = JSON.parse(content as string) as ReleaseReadinessResult;

    await db.saveReleaseReadiness({
      trackId,
      userId,
      overallSignal: result.overallSignal,
      overallScore: result.overallScore,
      dimensionSignals: result.dimensionSignals,
      blockers: result.blockers,
      analysisJson: result as unknown as Record<string, unknown>,
    });

    return result;
  } catch (error) {
    console.error("[ReleaseReadiness] Evaluation failed:", error);
    const latestReview = reviews[0];
    const scores = (latestReview?.scoresJson as Record<string, number>) ?? {};
    const avgScore = Object.values(scores).length > 0
      ? Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
      : 0;
    const overallScore = Math.round(avgScore * 10);
    const overallSignal = overallScore >= 70 ? "green" : overallScore >= 50 ? "yellow" : "red";

    return {
      overallSignal,
      overallScore,
      dimensionSignals: {},
      blockers: overallSignal === "red" ? [{ dimension: "overall", severity: "major", description: "Scores below release threshold", fix: "Address the lowest-scoring dimensions" }] : [],
      strengths: [],
      readinessStatement: `Overall score: ${overallScore}/100. ${overallSignal === "green" ? "Track appears release-ready." : "Review the detailed analysis for improvement areas."}`,
      estimatedEffort: overallSignal === "green" ? "Ready to release" : "Review needed",
    };
  }
}

export async function getReleaseReadinessHistory(trackId: number) {
  return db.getReleaseReadinessByTrack(trackId);
}

export async function getLatestReadiness(trackId: number) {
  return db.getLatestReleaseReadiness(trackId);
}
