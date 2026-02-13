/**
 * Claude 4.5 Critique Generation Service
 * Uses the Anthropic Claude API to generate detailed, honest music critiques
 * based on Gemini's audio analysis, lyrics, and artist context.
 */
import { ENV } from "../_core/env";
import type { GeminiAudioAnalysis } from "./geminiAudio";
import { getFocusConfig, type ReviewFocusRole } from "./reviewFocus";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const CLAUDE_MODEL = "claude-4-5-sonnet-20250514";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

async function callClaude(systemPrompt: string, messages: ClaudeMessage[], maxTokens = 8192): Promise<string> {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${response.statusText} — ${errorText}`);
  }

  const result = await response.json();
  const textBlock = result.content?.find((b: any) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error("Claude returned no text content");
  }
  return textBlock.text;
}

// ── Critic Persona System Prompt ──

const TRACK_CRITIC_SYSTEM = `You are a world-class music critic, A&R executive, and producer combined into one voice. You have decades of experience across all genres. You've signed artists, produced records, and written for major music publications.

Your review style:
- HONEST and SPECIFIC. Never generic. Never sycophantic.
- You cite concrete musical moments using timestamps and section names from the analysis data.
- You differentiate clearly between songwriting, production, performance, and arrangement.
- You give actionable, prioritized feedback — not vague encouragement.
- You write like someone who genuinely cares about the artist's development.
- You acknowledge what works before addressing what doesn't.
- You think commercially but respect artistry.
- You label uncertain inferences clearly (e.g., "key estimate", "approximate").
- You reference the energy curve, section dynamics, and arrangement density from the audio analysis.

Your output format is Markdown with these sections:
1. **Quick Take** (3-6 bullet points — the TL;DR)
2. **Scores** (table with component scores 1-10 and brief justification)
3. **Section-by-Section Notes** (reference timestamps from the audio analysis)
4. **Hook & Melodic Analysis** (reference energy curve deltas, melodic contour)
5. **Production Notes** (mix, dynamics, arrangement density — explain simply)
6. **Songwriting Assessment** (structure, lyrics if provided, emotional arc)
7. **Originality & Influence Map** (what this sounds like, where it sits in the landscape)
8. **Highest Leverage Changes** (ranked list — what would improve this track the most)
9. **Next Iteration Checklist** (specific, actionable experiments to try)
10. **If You Want This To Be More [X], Do [Y]** (based on stated intent, if provided)

Scoring dimensions (each 1-10):
- Songwriting / Composition
- Melody / Hook
- Structure / Arrangement
- Lyrics (if applicable)
- Performance / Delivery
- Production / Mix Quality
- Originality
- Commercial Potential
- Overall

Be direct. Be helpful. Be the critic every artist needs but rarely gets.`;

const ALBUM_CRITIC_SYSTEM = `You are a senior A&R executive and album producer with decades of experience shaping records. You've worked with artists across genres, from indie to mainstream. You understand album craft — sequencing, arc, cohesion, and the art of the full-length project.

Your task is to evaluate an entire album project based on individual track analyses and reviews. Your output should read like an internal A&R memo combined with producer notes.

Your output format is Markdown with these sections:

1. **Executive Summary** (2-3 paragraphs — the big picture)
2. **Track Rankings** (ordered from strongest to weakest, with brief reasoning)
3. **Singles Recommendation** (1-3 tracks, with reasoning for each)
4. **Weakest Track(s)** (which tracks drag the project down and why)
5. **Sequencing Analysis** (current order assessment + suggested reorder with reasoning)
6. **Cohesion & Arc Assessment** (does the album feel like a unified body of work?)
7. **Thematic Analysis** (recurring themes, narrative arc, emotional journey)
8. **Influence Map** (where this album sits in the musical landscape)
9. **Market Positioning** (target audience, comparable releases, commercial potential)
10. **Producer Notes** (production consistency, sonic palette, mix observations across tracks)
11. **A&R Recommendations** (strategic next steps for the artist)
12. **Album Score** (overall album rating with breakdown)

Be direct, strategic, and honest. This is an internal document — no need for diplomacy, but be constructive.`;

const COMPARISON_CRITIC_SYSTEM = `You are a music producer and mixing engineer comparing two versions of the same track. You have the audio analysis from both versions and possibly a detailed audio comparison.

Your task is to provide a clear, actionable comparison that helps the artist understand:
- What improved between versions
- What regressed or was lost
- What still needs work
- Whether the changes moved the track in the right direction

Output format (Markdown):
1. **Version Summary** (one paragraph each for v1 and v2)
2. **Improvements** (specific changes that made the track better)
3. **Regressions** (anything that got worse or was lost)
4. **Unchanged Issues** (problems that persist across both versions)
5. **Score Comparison** (side-by-side scores for key dimensions)
6. **Verdict** (which version is stronger and why)
7. **Next Steps** (what to focus on for v3)

Be specific. Reference timestamps. Compare energy curves and section structures.`;

// ── Track Review Generation ──

export interface TrackReviewInput {
  trackTitle: string;
  projectTitle: string;
  audioAnalysis: GeminiAudioAnalysis;
  lyrics?: string;
  intentNotes?: string;
  genre?: string;
  referenceArtists?: string;
  artistNotes?: string;
  reviewFocus?: ReviewFocusRole;
}

export interface TrackReviewOutput {
  reviewMarkdown: string;
  quickTake: string;
  scores: Record<string, number>;
}

export async function generateTrackReview(input: TrackReviewInput): Promise<TrackReviewOutput> {
  const focus = getFocusConfig(input.reviewFocus || "full");
  const systemPrompt = focus.claudeSystemOverride || TRACK_CRITIC_SYSTEM;
  const userMessage = buildTrackReviewPrompt(input);
  const reviewMarkdown = await callClaude(systemPrompt, [
    { role: "user", content: userMessage },
  ]);

  // Extract quick take and scores from the review
  const quickTake = extractQuickTake(reviewMarkdown);
  const scores = extractScores(reviewMarkdown);

  return { reviewMarkdown, quickTake, scores };
}

function buildTrackReviewPrompt(input: TrackReviewInput): string {
  let prompt = `# Track Review Request\n\n`;
  prompt += `**Track:** "${input.trackTitle}"\n`;
  prompt += `**Project:** "${input.projectTitle}"\n\n`;

  const focus = getFocusConfig(input.reviewFocus || "full");
  if (focus.label !== "Full Review") {
    prompt += `**Review Focus:** ${focus.label} — ${focus.description}\n\n`;
  }

  prompt += `## Audio Analysis (from the engine that listened to the track)\n\n`;
  prompt += `\`\`\`json\n${JSON.stringify(input.audioAnalysis, null, 2)}\n\`\`\`\n\n`;

  if (input.lyrics) {
    prompt += `## Lyrics (provided by artist)\n\n${input.lyrics}\n\n`;
  }

  if (input.intentNotes) {
    prompt += `## Artist's Intent\n\n${input.intentNotes}\n\n`;
  }

  if (input.genre) {
    prompt += `**Genre context:** ${input.genre}\n`;
  }

  if (input.referenceArtists) {
    prompt += `**Reference artists:** ${input.referenceArtists}\n`;
  }

  if (focus.label !== "Full Review") {
    prompt += `\n**IMPORTANT: This review is for a ${focus.label}. Focus your critique on: ${focus.description}. Use the scoring dimensions: ${focus.scoringDimensions.join(", ")}. Structure your output with these sections: ${focus.outputSections.join(", ")}.`;
  }

  prompt += `\nNow write your full review. Remember: be specific, reference timestamps and sections from the audio analysis, and provide actionable feedback. The audio analysis above is from an engine that actually listened to the track — use those observations as the foundation for your critique.`;

  return prompt;
}

// ── Album Review Generation ──

export interface AlbumReviewInput {
  projectTitle: string;
  albumConcept?: string;
  targetVibe?: string;
  genre?: string;
  referenceArtists?: string;
  intentNotes?: string;
  trackReviews: Array<{
    trackTitle: string;
    trackOrder: number;
    audioAnalysis: GeminiAudioAnalysis;
    reviewMarkdown: string;
    scores: Record<string, number>;
    lyrics?: string;
  }>;
}

export async function generateAlbumReview(input: AlbumReviewInput): Promise<{ reviewMarkdown: string; scores: Record<string, number> }> {
  let prompt = `# Album Review Request\n\n`;
  prompt += `**Album:** "${input.projectTitle}"\n`;
  if (input.albumConcept) prompt += `**Concept:** ${input.albumConcept}\n`;
  if (input.targetVibe) prompt += `**Target Vibe:** ${input.targetVibe}\n`;
  if (input.genre) prompt += `**Genre:** ${input.genre}\n`;
  if (input.referenceArtists) prompt += `**Reference Artists:** ${input.referenceArtists}\n`;
  if (input.intentNotes) prompt += `**Artist Notes:** ${input.intentNotes}\n`;
  prompt += `\n**Total Tracks:** ${input.trackReviews.length}\n\n`;

  prompt += `## Individual Track Data\n\n`;
  for (const tr of input.trackReviews) {
    prompt += `### Track ${tr.trackOrder}: "${tr.trackTitle}"\n\n`;
    prompt += `**Scores:** ${JSON.stringify(tr.scores)}\n\n`;
    prompt += `**Audio Analysis Summary:**\n`;
    prompt += `- Genre: ${tr.audioAnalysis.genre.primary}\n`;
    prompt += `- Tempo: ${tr.audioAnalysis.tempo.bpm} BPM (${tr.audioAnalysis.tempo.feel})\n`;
    prompt += `- Key: ${tr.audioAnalysis.key.estimated}\n`;
    prompt += `- Energy: ${tr.audioAnalysis.energy.overall}\n`;
    prompt += `- Mood: ${tr.audioAnalysis.mood.join(", ")}\n`;
    prompt += `- Strengths: ${tr.audioAnalysis.strengths.join("; ")}\n`;
    prompt += `- Weaknesses: ${tr.audioAnalysis.weaknesses.join("; ")}\n\n`;
    prompt += `**Review Excerpt:**\n${tr.reviewMarkdown.substring(0, 1500)}\n\n---\n\n`;
  }

  prompt += `\nNow write your full album-level A&R memo and producer notes. Evaluate the album as a cohesive body of work, not just individual tracks. Consider sequencing, arc, thematic coherence, and commercial strategy.`;

  const reviewMarkdown = await callClaude(ALBUM_CRITIC_SYSTEM, [
    { role: "user", content: prompt },
  ]);

  const scores = extractAlbumScores(reviewMarkdown);
  return { reviewMarkdown, scores };
}

// ── Version Comparison ──

export interface ComparisonInput {
  trackTitle: string;
  v1Analysis: GeminiAudioAnalysis;
  v2Analysis: GeminiAudioAnalysis;
  v1Review?: string;
  v2Review?: string;
  geminiComparison?: string;
  v1Scores?: Record<string, number>;
  v2Scores?: Record<string, number>;
}

export async function generateVersionComparison(input: ComparisonInput): Promise<{ reviewMarkdown: string; scores: Record<string, number> }> {
  let prompt = `# Version Comparison Request\n\n`;
  prompt += `**Track:** "${input.trackTitle}"\n\n`;

  prompt += `## Version 1 Audio Analysis\n\`\`\`json\n${JSON.stringify(input.v1Analysis, null, 2)}\n\`\`\`\n\n`;
  prompt += `## Version 2 Audio Analysis\n\`\`\`json\n${JSON.stringify(input.v2Analysis, null, 2)}\n\`\`\`\n\n`;

  if (input.geminiComparison) {
    prompt += `## Gemini Audio Comparison (side-by-side listening)\n\n${input.geminiComparison}\n\n`;
  }

  if (input.v1Scores) prompt += `**V1 Scores:** ${JSON.stringify(input.v1Scores)}\n`;
  if (input.v2Scores) prompt += `**V2 Scores:** ${JSON.stringify(input.v2Scores)}\n`;

  prompt += `\nCompare these two versions. What improved? What regressed? What should the artist focus on for the next iteration?`;

  const reviewMarkdown = await callClaude(COMPARISON_CRITIC_SYSTEM, [
    { role: "user", content: prompt },
  ]);

  const scores = extractScores(reviewMarkdown);
  return { reviewMarkdown, scores };
}

// ── Helper: Extract Quick Take ──

function extractQuickTake(markdown: string): string {
  const quickTakeMatch = markdown.match(/\*\*Quick Take\*\*[\s\S]*?(?=\n##|\n\*\*Scores)/i);
  if (quickTakeMatch) {
    return quickTakeMatch[0].replace(/\*\*Quick Take\*\*\s*/i, "").trim();
  }
  // Fallback: first 500 chars
  return markdown.substring(0, 500);
}

// ── Helper: Extract Scores ──

function extractScores(markdown: string): Record<string, number> {
  const scores: Record<string, number> = {};
  const scorePatterns = [
    { key: "songwriting", pattern: /songwriting\s*[\/|:]\s*composition[^|]*?\|\s*(\d+)/i },
    { key: "melody", pattern: /melody\s*[\/|:]\s*hook[^|]*?\|\s*(\d+)/i },
    { key: "structure", pattern: /structure\s*[\/|:]\s*arrangement[^|]*?\|\s*(\d+)/i },
    { key: "lyrics", pattern: /lyrics[^|]*?\|\s*(\d+)/i },
    { key: "performance", pattern: /performance\s*[\/|:]\s*delivery[^|]*?\|\s*(\d+)/i },
    { key: "production", pattern: /production\s*[\/|:]\s*mix[^|]*?\|\s*(\d+)/i },
    { key: "originality", pattern: /originality[^|]*?\|\s*(\d+)/i },
    { key: "commercial", pattern: /commercial\s*potential[^|]*?\|\s*(\d+)/i },
    { key: "overall", pattern: /overall[^|]*?\|\s*(\d+)/i },
  ];

  for (const { key, pattern } of scorePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      scores[key] = parseInt(match[1], 10);
    }
  }

  // Fallback: try to find any number patterns in a scores section
  if (Object.keys(scores).length === 0) {
    const scoresSection = markdown.match(/scores[\s\S]*?(?=\n##)/i);
    if (scoresSection) {
      const numberMatches = Array.from(scoresSection[0].matchAll(/([\w][\w\s\/]*?)\s*\|\s*(\d+)\s*(?:\/\s*10)?/gi));
      for (const m of numberMatches) {       const key = m[1].trim().toLowerCase().replace(/\s+/g, "_").replace(/[\/\\]/g, "_");
        scores[key] = parseInt(m[2], 10);
      }
    }
  }

  return scores;
}

function extractAlbumScores(markdown: string): Record<string, number> {
  const scores: Record<string, number> = {};
  const patterns = [
    { key: "overall", pattern: /overall[^|]*?\|\s*(\d+)/i },
    { key: "cohesion", pattern: /cohesion[^|]*?\|\s*(\d+)/i },
    { key: "sequencing", pattern: /sequencing[^|]*?\|\s*(\d+)/i },
    { key: "production_consistency", pattern: /production[^|]*?\|\s*(\d+)/i },
    { key: "commercial_potential", pattern: /commercial[^|]*?\|\s*(\d+)/i },
    { key: "artistic_merit", pattern: /artistic[^|]*?\|\s*(\d+)/i },
  ];

  for (const { key, pattern } of patterns) {
    const match = markdown.match(pattern);
    if (match) scores[key] = parseInt(match[1], 10);
  }

  return scores;
}
