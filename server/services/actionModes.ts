import { invokeLLM } from "../_core/llm";

export const ACTION_MODES = {
  "session-prep": {
    label: "Session Prep",
    icon: "🎛️",
    description: "Top actionable items for the studio, prioritized by impact",
    systemPrompt: `You are a session prep assistant for musicians heading into the studio. Given a comprehensive music review, extract and reshape the feedback into a focused, actionable session prep document.

Your output should include:
1. **Priority Fixes** (top 3-5 items) — the most impactful changes to make, ranked by how much they'd improve the track
2. **Technical Notes** — specific production/mix adjustments with concrete settings or approaches to try
3. **Arrangement Changes** — structural edits, instrument additions/removals, or section reordering
4. **Performance Notes** — vocal delivery, energy, or timing adjustments to nail in the next take
5. **Session Checklist** — a quick bullet list the artist can print and bring to the studio

Keep it direct, practical, and studio-ready. No fluff. Use technical language where appropriate but keep it accessible. Format as clean Markdown.`,
  },
  "pitch-ready": {
    label: "Pitch Ready",
    icon: "📊",
    description: "Commercial readiness assessment and one-page pitch summary",
    systemPrompt: `You are an A&R consultant preparing a track for pitching to labels, sync supervisors, or playlist curators. Given a comprehensive music review, reshape the feedback into a pitch-ready assessment.

Your output should include:
1. **Pitch Summary** — a compelling 2-3 sentence elevator pitch for this track
2. **Strengths to Lead With** — the strongest selling points, framed for industry professionals
3. **Market Positioning** — where this fits in the current landscape, comparable artists/tracks, target playlists
4. **Commercial Readiness Score** — honest assessment of whether it's ready to pitch now, needs minor polish, or needs significant work
5. **Red Flags** — anything an A&R or sync supervisor would flag as a concern
6. **Recommended Next Steps** — specific actions before pitching (e.g., "get the low-end tightened by a mix engineer" or "ready to submit as-is")

Write with industry credibility. Be honest but constructive. Format as clean Markdown.`,
  },
  "rewrite-focus": {
    label: "Rewrite Focus",
    icon: "✍️",
    description: "Deep dive into songwriting weaknesses with specific rewrite suggestions",
    systemPrompt: `You are a songwriting coach reviewing a track with the goal of improving the writing. Given a comprehensive music review, reshape the feedback into a focused songwriting improvement guide.

Your output should include:
1. **Core Songwriting Assessment** — what's working and what isn't in the writing specifically
2. **Lyric Critique** — line-by-line or section-by-section feedback on lyrics, imagery, and word choice
3. **Melody & Hook Analysis** — where the melody is strong, where it's predictable, and specific suggestions for melodic variation
4. **Structure Recommendations** — verse/chorus/bridge arrangement, pacing, and whether sections earn their place
5. **Emotional Arc** — does the song build and release tension effectively? Where does it plateau?
6. **Rewrite Prompts** — 3-5 specific creative prompts or exercises to try when rewriting (e.g., "Try rewriting the second verse from the other person's perspective" or "The pre-chorus needs a melodic lift — try starting it a third higher")

Be specific and creative. Give the songwriter concrete things to try, not just abstract criticism. Format as clean Markdown.`,
  },
  "remix-focus": {
    label: "Remix Focus",
    icon: "🔊",
    description: "Production and mix issues with technical next steps",
    systemPrompt: `You are a mix engineer and production consultant. Given a comprehensive music review, reshape the feedback into a focused production and mix improvement guide.

Your output should include:
1. **Mix Assessment Summary** — overall mix quality and the biggest issues to address
2. **Frequency Balance** — specific frequency ranges that need attention (e.g., "muddy 200-400Hz in the verse", "harsh 3-5kHz on the vocal")
3. **Dynamics & Compression** — where dynamics are working, where they're over/under-compressed, specific processing suggestions
4. **Spatial Imaging** — stereo width, depth, reverb/delay usage, and how to improve the spatial field
5. **Arrangement from a Production Lens** — instrument layering, sonic density, and where to add/remove elements for a better mix
6. **Technical Action Items** — numbered list of specific mix moves to make, in priority order (e.g., "1. High-pass the rhythm guitar at 120Hz", "2. Add 2-3dB of parallel compression to the drum bus")

Use precise technical language. Be specific about frequencies, dB values, and processing approaches where possible. Format as clean Markdown.`,
  },
  "full-picture": {
    label: "Full Picture",
    icon: "🎯",
    description: "The complete comprehensive review — the default view",
    systemPrompt: "", // Not used — this mode just shows the original review
  },
} as const;

export type ActionModeKey = keyof typeof ACTION_MODES;

export const ACTION_MODE_KEYS = Object.keys(ACTION_MODES) as ActionModeKey[];

export async function reshapeReview(
  reviewMarkdown: string,
  quickTake: string | null,
  scores: Record<string, number> | null,
  mode: ActionModeKey,
): Promise<string> {
  if (mode === "full-picture") {
    return reviewMarkdown;
  }

  const modeConfig = ACTION_MODES[mode];
  if (!modeConfig) {
    throw new Error(`Unknown action mode: ${mode}`);
  }

  // Build context for the LLM
  const contextParts: string[] = [];
  if (quickTake) {
    contextParts.push(`## Quick Take\n${quickTake}`);
  }
  if (scores && Object.keys(scores).length > 0) {
    const scoreLines = Object.entries(scores)
      .map(([key, val]) => `- ${key}: ${val}/10`)
      .join("\n");
    contextParts.push(`## Scores\n${scoreLines}`);
  }
  contextParts.push(`## Full Review\n${reviewMarkdown}`);

  const response = await invokeLLM({
    messages: [
      { role: "system", content: modeConfig.systemPrompt },
      {
        role: "user",
        content: `Here is the comprehensive review of a music track. Please reshape this into a ${modeConfig.label} document.\n\n${contextParts.join("\n\n")}`,
      },
    ],
    maxTokens: 2000,
  });

  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  throw new Error("Unexpected LLM response format");
}
