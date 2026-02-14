/**
 * Shared score color utility for consistent color-coding across the app.
 * Maps a 0-10 score to a Tailwind text color class.
 */
export function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-sky-400";
  if (score >= 4) return "text-amber-400";
  return "text-rose-400";
}

/**
 * Returns a full color config object for charts and visualizations.
 * Includes fill, stroke, and text colors.
 */
export function getScoreColorConfig(score: number) {
  if (score >= 8) return { fill: "rgba(52, 211, 153, 0.15)", stroke: "rgba(52, 211, 153, 0.8)", text: "text-emerald-400" };
  if (score >= 6) return { fill: "rgba(56, 189, 248, 0.15)", stroke: "rgba(56, 189, 248, 0.8)", text: "text-sky-400" };
  if (score >= 4) return { fill: "rgba(251, 191, 36, 0.12)", stroke: "rgba(251, 191, 36, 0.7)", text: "text-amber-400" };
  return { fill: "rgba(251, 113, 133, 0.12)", stroke: "rgba(251, 113, 133, 0.7)", text: "text-rose-400" };
}
