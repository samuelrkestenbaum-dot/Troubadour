/**
 * Feature 1: Longitudinal Improvement Tracking
 * 
 * Extracts dimension scores from every review and tracks them over time.
 * Uses Claude 4.5 to analyze trends, identify plateaus, and provide
 * actionable improvement insights.
 */

import { invokeLLM } from "../_core/llm";
import * as db from "../db";

// Score dimension mapping per focus mode
const FOCUS_MODE_DIMENSIONS: Record<string, string[]> = {
  production: ["mixClarity", "soundDesign", "arrangement", "dynamics", "spatialImaging"],
  songwriting: ["melody", "harmony", "lyricalContent", "songStructure", "emotionalImpact"],
  performance: ["vocalTechnique", "instrumentalProficiency", "timing", "expression", "stagePresence"],
  mixing: ["frequencyBalance", "stereoField", "dynamics", "effects", "overallCohesion"],
  mastering: ["loudness", "toneBalance", "stereoWidth", "dynamicRange", "formatReadiness"],
  general: ["overall", "production", "songwriting", "performance", "originality"],
};

/**
 * Extract and persist dimension scores from a completed review.
 * Called after each review is generated.
 */
export async function extractAndSaveScores(params: {
  userId: number;
  trackId: number;
  reviewId: number;
  focusMode: string;
  scores: Record<string, number>;
  genre?: string;
}) {
  const { userId, trackId, reviewId, focusMode, scores, genre } = params;
  const entries = Object.entries(scores)
    .filter(([_, score]) => typeof score === "number" && score >= 0 && score <= 10)
    .map(([dimension, score]) => ({
      userId,
      trackId,
      reviewId,
      focusMode,
      dimension,
      score,
      genre: genre ?? null,
    }));

  if (entries.length > 0) {
    await db.saveSkillProgression(entries);
  }
  return entries.length;
}

/**
 * Get the full skill progression timeline for a user.
 */
export async function getProgressionTimeline(userId: number, options?: {
  focusMode?: string;
  dimension?: string;
}) {
  if (options?.dimension) {
    return db.getSkillProgressionByDimension(userId, options.dimension);
  }
  if (options?.focusMode) {
    return db.getSkillProgressionByFocusMode(userId, options.focusMode);
  }
  return db.getSkillProgressionByUser(userId);
}

/**
 * Get a high-level overview of skill progression across all dimensions.
 */
export async function getProgressionOverview(userId: number) {
  return db.getSkillProgressionOverview(userId);
}

export interface TrendAnalysis {
  overallTrajectory: "improving" | "plateauing" | "declining" | "insufficient_data";
  strongestGrowth: { dimension: string; delta: number; insight: string } | null;
  biggestChallenge: { dimension: string; avgScore: number; insight: string } | null;
  plateaus: Array<{ dimension: string; score: number; since: string }>;
  recommendations: Array<{ priority: number; dimension: string; action: string; expectedImpact: string }>;
  milestones: Array<{ dimension: string; achievement: string; date: string }>;
  nextGoals: Array<{ dimension: string; currentScore: number; targetScore: number; suggestion: string }>;
  summary: string;
}

/**
 * Use Claude 4.5 to analyze skill progression trends and provide insights.
 */
export async function analyzeTrends(userId: number): Promise<TrendAnalysis> {
  const overview = await db.getSkillProgressionOverview(userId);
  const allData = await db.getSkillProgressionByUser(userId);

  if (overview.length === 0 || allData.length < 3) {
    return {
      overallTrajectory: "insufficient_data",
      strongestGrowth: null,
      biggestChallenge: null,
      plateaus: [],
      recommendations: [],
      milestones: [],
      nextGoals: [],
      summary: "Need at least 3 reviewed tracks to analyze trends. Keep uploading!",
    };
  }

  // Group data by dimension for time series
  const timeSeries: Record<string, Array<{ score: number; date: string; trackId: number }>> = {};
  for (const row of allData) {
    if (!timeSeries[row.dimension]) timeSeries[row.dimension] = [];
    timeSeries[row.dimension].push({
      score: row.score,
      date: row.createdAt.toISOString().slice(0, 10),
      trackId: row.trackId,
    });
  }

  const prompt = `You are an expert music production coach analyzing an artist's skill progression over time.

Here is the artist's score history across dimensions:

OVERVIEW (latest vs first score per dimension):
${overview.map(d => `- ${d.dimension} (${d.focusMode}): ${d.firstScore} → ${d.latestScore} (Δ${d.delta >= 0 ? "+" : ""}${d.delta}, ${d.dataPoints} data points, avg ${d.avgScore})`).join("\n")}

TIME SERIES DATA:
${Object.entries(timeSeries).map(([dim, points]) => 
  `${dim}: ${points.map(p => `${p.score}/10 (${p.date})`).join(" → ")}`
).join("\n")}

Analyze the artist's progression and provide actionable insights. Look for:
1. Overall trajectory (improving, plateauing, or declining)
2. Strongest growth areas and biggest challenges
3. Plateaus (dimensions stuck at the same score for 3+ tracks)
4. Specific, actionable recommendations prioritized by impact
5. Milestones achieved (e.g., first time scoring 8+ in a dimension)
6. Next goals to work toward

Be encouraging but honest. Focus on practical, specific advice.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a music production coach. Return JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "trend_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallTrajectory: { type: "string", enum: ["improving", "plateauing", "declining"] },
              strongestGrowth: {
                type: "object",
                properties: {
                  dimension: { type: "string" },
                  delta: { type: "number" },
                  insight: { type: "string" },
                },
                required: ["dimension", "delta", "insight"],
                additionalProperties: false,
              },
              biggestChallenge: {
                type: "object",
                properties: {
                  dimension: { type: "string" },
                  avgScore: { type: "number" },
                  insight: { type: "string" },
                },
                required: ["dimension", "avgScore", "insight"],
                additionalProperties: false,
              },
              plateaus: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dimension: { type: "string" },
                    score: { type: "number" },
                    since: { type: "string" },
                  },
                  required: ["dimension", "score", "since"],
                  additionalProperties: false,
                },
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    priority: { type: "number" },
                    dimension: { type: "string" },
                    action: { type: "string" },
                    expectedImpact: { type: "string" },
                  },
                  required: ["priority", "dimension", "action", "expectedImpact"],
                  additionalProperties: false,
                },
              },
              milestones: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dimension: { type: "string" },
                    achievement: { type: "string" },
                    date: { type: "string" },
                  },
                  required: ["dimension", "achievement", "date"],
                  additionalProperties: false,
                },
              },
              nextGoals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dimension: { type: "string" },
                    currentScore: { type: "number" },
                    targetScore: { type: "number" },
                    suggestion: { type: "string" },
                  },
                  required: ["dimension", "currentScore", "targetScore", "suggestion"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["overallTrajectory", "strongestGrowth", "biggestChallenge", "plateaus", "recommendations", "milestones", "nextGoals", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : "";
    if (!content) throw new Error("Empty LLM response");
    return JSON.parse(content) as TrendAnalysis;
  } catch (error) {
    console.error("[SkillTracker] Trend analysis failed:", error);
    // Fallback: compute basic stats without LLM
    const sorted = [...overview].sort((a, b) => b.delta - a.delta);
    const weakest = [...overview].sort((a, b) => a.avgScore - b.avgScore);
    return {
      overallTrajectory: overview.reduce((sum, d) => sum + d.delta, 0) > 0 ? "improving" : "plateauing",
      strongestGrowth: sorted[0] ? { dimension: sorted[0].dimension, delta: sorted[0].delta, insight: `Improved by ${sorted[0].delta} points` } : null,
      biggestChallenge: weakest[0] ? { dimension: weakest[0].dimension, avgScore: weakest[0].avgScore, insight: `Averaging ${weakest[0].avgScore}/10` } : null,
      plateaus: [],
      recommendations: [{ priority: 1, dimension: weakest[0]?.dimension ?? "general", action: "Focus on your weakest area", expectedImpact: "Balanced improvement" }],
      milestones: [],
      nextGoals: overview.slice(0, 3).map(d => ({ dimension: d.dimension, currentScore: d.latestScore, targetScore: Math.min(10, d.latestScore + 1), suggestion: "Aim for +1 on your next track" })),
      summary: "Keep uploading tracks to build a clearer picture of your progression.",
    };
  }
}

export { FOCUS_MODE_DIMENSIONS };
