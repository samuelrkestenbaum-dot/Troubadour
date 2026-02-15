/**
 * Claude 4.5 Critique Generation Service
 * Uses the Forge API gateway to access Claude Sonnet 4.5 for detailed, honest music critiques
 * based on Gemini's audio analysis, lyrics, and artist context.
 */
import { ENV } from "../_core/env";
import type { GeminiAudioAnalysis } from "./geminiAudio";
import { getFocusConfig, type ReviewFocusRole } from "./reviewFocus";

export const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

interface ClaudeMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function resolveApiUrl(): string {
  const base = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? ENV.forgeApiUrl.replace(/\/$/, "")
    : "https://forge.manus.im";
  return `${base}/v1/chat/completions`;
}

function assertApiKey(): void {
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
}

const LLM_TIMEOUT_MS = 120_000; // 2 minutes per LLM call
const LLM_MAX_RETRIES = 2;
const LLM_RETRY_DELAY_MS = 3000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callClaude(systemPrompt: string, messages: ClaudeMessage[], maxTokens = 4096): Promise<string> {
  assertApiKey();

  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Claude] Retry attempt ${attempt}/${LLM_MAX_RETRIES}...`);
        await sleep(LLM_RETRY_DELAY_MS * attempt); // Exponential-ish backoff
      }

      const response = await fetchWithTimeout(resolveApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENV.forgeApiKey}`,
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          messages: allMessages,
        }),
      }, LLM_TIMEOUT_MS);

      if (!response.ok) {
        const errorText = await response.text();
        // Retry on 5xx or 429 (rate limit)
        if (response.status >= 500 || response.status === 429) {
          lastError = new Error(`Claude API error: ${response.status} ${response.statusText} — ${errorText}`);
          continue;
        }
        throw new Error(`Claude API error: ${response.status} ${response.statusText} — ${errorText}`);
      }

      const result = await response.json();
      
      const choice = result.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error("Claude returned no text content");
      }
      
      const content = choice.message.content;
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        const textBlock = content.find((b: any) => b.type === "text");
        return textBlock?.text || "";
      }
      
      throw new Error("Claude returned unexpected content format");
    } catch (err: any) {
      if (err.name === "AbortError") {
        lastError = new Error(`Claude API timed out after ${LLM_TIMEOUT_MS / 1000}s`);
        continue;
      }
      // Don't retry client errors
      if (!lastError || err.message?.includes("Claude API error: 4")) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("Claude API failed after retries");
}

// ── Summarize audio analysis to keep prompt size manageable ──

function summarizeAudioAnalysis(analysis: GeminiAudioAnalysis): string {
  const lines: string[] = [];
  
  if (analysis.overview) {
    lines.push(`**Overview:** ${analysis.overview}`);
  }
  if (analysis.genre) {
    lines.push(`**Genre:** ${analysis.genre.primary}${analysis.genre.secondary?.length ? ` (${analysis.genre.secondary.join(", ")})` : ""}${analysis.genre.influences?.length ? ` | Influences: ${analysis.genre.influences.join(", ")}` : ""}`);
  }
  if (analysis.tempo) {
    lines.push(`**Tempo:** ${analysis.tempo.bpm} BPM (${analysis.tempo.confidence} confidence), feel: ${analysis.tempo.feel}`);
  }
  if (analysis.key) {
    lines.push(`**Key:** ${analysis.key.estimated} (${analysis.key.modality}, ${analysis.key.confidence} confidence)`);
  }
  if (analysis.energy) {
    lines.push(`**Energy:** overall ${analysis.energy.overall}, dynamic range: ${analysis.energy.dynamicRange}`);
    if (analysis.energy.curve?.length) {
      lines.push(`**Energy Curve:** ${analysis.energy.curve.map(p => `${p.timestamp}: ${p.level}/10 (${p.description})`).join(" → ")}`);
    }
  }
  if (analysis.sections?.length) {
    lines.push(`**Sections:**`);
    for (const s of analysis.sections) {
      lines.push(`  - ${s.name} (${s.startTime}–${s.endTime}): energy ${s.energy}/10 — ${s.description}${s.musicalElements?.length ? ` [${s.musicalElements.join(", ")}]` : ""}`);
    }
  }
  if (analysis.instrumentation?.length) {
    lines.push(`**Instrumentation:** ${analysis.instrumentation.join(", ")}`);
  }
  if (analysis.melodicAnalysis) {
    const m = analysis.melodicAnalysis;
    lines.push(`**Melodic Analysis:** hook strength: ${m.hookStrength}, contour: ${m.melodicContour}, vocals: ${m.vocalCharacteristics}, memorability: ${m.memorability}`);
  }
  if (analysis.rhythmicAnalysis) {
    const r = analysis.rhythmicAnalysis;
    lines.push(`**Rhythmic Analysis:** groove: ${r.groove}, density: ${r.rhythmicDensity}, variation: ${r.rhythmicVariation}`);
  }
  if (analysis.production) {
    const p = analysis.production;
    lines.push(`**Production:** mix quality: ${p.mixQuality}, spatial: ${p.spatialCharacteristics}, frequency balance: ${p.frequencyBalance}, dynamics: ${p.dynamicProcessing}`);
    if (p.notableEffects?.length) lines.push(`  Effects: ${p.notableEffects.join(", ")}`);
  }
  if (analysis.arrangement) {
    const a = analysis.arrangement;
    lines.push(`**Arrangement:** density: ${a.density}, layering: ${a.layering}, transitions: ${a.transitions}, build/release: ${a.buildAndRelease}`);
  }
  if (analysis.mood?.length) {
    lines.push(`**Mood:** ${analysis.mood.join(", ")}`);
  }
  if (analysis.strengths?.length) {
    lines.push(`**Strengths:** ${analysis.strengths.join("; ")}`);
  }
  if (analysis.weaknesses?.length) {
    lines.push(`**Weaknesses:** ${analysis.weaknesses.join("; ")}`);
  }
  if (analysis.estimatedDuration) {
    lines.push(`**Duration:** ~${Math.round(analysis.estimatedDuration)}s`);
  }
  
  return lines.join("\n");
}

// ── Review Length Configuration ──

export type ReviewLength = "brief" | "standard" | "detailed";

const REVIEW_LENGTH_CONFIG: Record<ReviewLength, { wordRange: string; maxTokens: number; sections: string; }> = {
  brief: {
    wordRange: "400-600",
    maxTokens: 1200,
    sections: `Output format (Markdown):
1. **Quick Take** (3-4 punchy bullets — the TL;DR)
2. **Scores** (table as shown above — compact)
3. **Core Analysis** (2-3 paragraphs, 2 sentences each. Hit the key points only.)
4. **Top Changes** (The 3 highest-leverage changes. 3 bullet points.)`,
  },
  standard: {
    wordRange: "800-1200",
    maxTokens: 2000,
    sections: `Output format (Markdown):
1. **Quick Take** (3-4 punchy bullets — the TL;DR a busy artist reads first)
2. **Scores** (table as shown above — compact, no padding)
3. **Core Analysis** (Merge section-by-section, hook/melody, production, songwriting. Reference timestamps, energy curve, mix, frequency, dynamics, structure, emotional arc. 4-5 paragraphs, 2-3 sentences each.)
4. **Originality & Influence** (What it sounds like, what makes it unique. 2-3 sentences max.)
5. **Highest Leverage Changes** (The 3-5 changes that would improve the track most. 3-4 bullet points.)
6. **Next Steps & Trajectory** (Concrete steps for the next version. 3-4 bullet points.)`,
  },
  detailed: {
    wordRange: "1500-2000",
    maxTokens: 3000,
    sections: `Output format (Markdown):
1. **Quick Take** (4-5 punchy bullets — the TL;DR a busy artist reads first)
2. **Scores** (table as shown above — compact, no padding)
3. **Core Analysis** (Section-by-section breakdown with timestamps. 5-6 paragraphs, 3 sentences each.)
4. **Production Analysis** (Mix quality, frequency balance, dynamics, spatial characteristics. 2-3 paragraphs.)
5. **Arrangement Deep-Dive** (Structure effectiveness, transitions, density, layering. 2-3 paragraphs.)
6. **Originality & Influence** (What it sounds like, what makes it unique. 1 paragraph.)
7. **Highest Leverage Changes** (The 5-7 changes that would improve the track most. Bullet points.)
8. **Next Steps & Trajectory** (Concrete steps for the next version. 4-5 bullet points.)`,
  },
};

// ── Critic Persona System Prompt ──

function getTrackCriticSystem(length: ReviewLength = "standard"): string {
  const config = REVIEW_LENGTH_CONFIG[length];
  return `You are Troubadour — a sharp, experienced music critic and producer's confidant. Decades in studios, tens of thousands of tracks. You know what separates good from great. Honest, direct, knowledgeable, occasionally witty. Think Rick Rubin's ear, Quincy Jones' musicality, Anthony Fantano's candor. You commit to your take. Be direct. No filler. Every sentence must earn its place.

Rules:
- Reference specific timestamps, sections, and musical elements from analysis data.
- Tie observations to audio analysis (energy curve, sections, production data).
- Score each dimension 1-10 with a brief justification.
- Be specific: "kick at 1:23 is muddy around 200Hz" not "drums could be better."
- Acknowledge what works before critiquing.
- End with actionable next steps, not vague encouragement.
- Keep the review between ${config.wordRange} words.
- DO NOT repeat sections. Write each section exactly once.

For the Scores table, use this EXACT format:

### Scores

| Component | Score | Justification |
|---|---|---|
| Songwriting | 7 | Brief reason |
| Melody & Hooks | 8 | Brief reason |
| Arrangement | 6 | Brief reason |
| Performance | 7 | Brief reason |
| Production & Mix | 7 | Brief reason |
| Originality | 6 | Brief reason |
| Commercial Potential | 7 | Brief reason |
| Overall | 7 | Brief reason |

${config.sections}

Be direct. Be helpful. Be the critic every artist needs but rarely gets.`;
}

// Keep backward-compatible constant for role-specific overrides that don't use it
const TRACK_CRITIC_SYSTEM = getTrackCriticSystem("standard");

const ALBUM_CRITIC_SYSTEM = `You are a senior A&R executive and album producer with decades of experience shaping records. You understand album craft — sequencing, arc, cohesion, and the art of the full-length project.

You think about albums the way great producers do: as emotional journeys, not just collections of songs. You understand that the spaces between tracks matter as much as the tracks themselves. You consider key relationships, tempo flow, energy dynamics, and thematic threads that tie a project together.

Keep your review between 2000-4000 words. Do NOT repeat sections.

For scores, use this EXACT format:
| Component | Score | Justification |
|---|---|---|
| Category | 7 | Brief reason |

Output sections:
1. **Executive Summary** (2-3 paragraphs — the big picture: what this album IS and what it's trying to be)
2. **Thematic Threads** (identify recurring lyrical themes, sonic motifs, emotional currents that connect tracks — what story does this album tell?)
3. **Track Rankings** (strongest to weakest, with 1-sentence justification each)
4. **Singles Strategy** (1-3 tracks as lead single, follow-up, and deep cut pick — explain commercial rationale)
5. **Sequencing Analysis** (current order critique + suggested reorder with reasoning for each move — consider key relationships, tempo flow, energy arc)
6. **Album Arc & Emotional Journey** (map the emotional trajectory — where does it peak? where does it breathe? is the closer satisfying?)
7. **Cohesion Assessment** (sonic palette consistency, production continuity, genre coherence — does it feel like ONE project?)
8. **Market Positioning** (comparable albums, target audience, playlist fit, release strategy suggestions)
9. **A&R Recommendations** (what to add, cut, or rework before release — be specific and honest)
10. **Album Score** (overall rating with breakdown table using categories: Songwriting, Production, Cohesion, Sequencing, Commercial Potential, Artistic Vision, Overall)

Be direct, strategic, and honest. Think like someone who has shaped platinum records but respects independent artistry.`;

const COMPARISON_CRITIC_SYSTEM = `You are a music producer and mixing engineer comparing two versions of the same track.

Keep your comparison between 1000-2000 words. Do NOT repeat sections.

Output format:
1. **Version Summary** (one paragraph each)
2. **Improvements** (specific changes that made it better)
3. **Regressions** (anything that got worse)
4. **Unchanged Issues** (problems that persist)
5. **Score Comparison** (side-by-side table)
6. **Verdict** (which version is stronger)
7. **Next Steps** (what to focus on for v3)

Be specific. Reference timestamps.`;

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
  /** Review length: brief, standard, or detailed */
  reviewLength?: ReviewLength;
  /** Custom template focus areas from user-created templates */
  templateFocusAreas?: string[];
  /** Previous review context for smart re-review */
  previousReview?: {
    reviewMarkdown: string;
    scores: Record<string, number>;
    quickTake?: string;
    reviewVersion: number;
    createdAt: Date;
  };
}

export interface TrackReviewOutput {
  reviewMarkdown: string;
  quickTake: string;
  scores: Record<string, number>;
}

export async function generateTrackReview(input: TrackReviewInput): Promise<TrackReviewOutput> {
  const focus = getFocusConfig(input.reviewFocus || "full");
  const length = input.reviewLength || "standard";
  const config = REVIEW_LENGTH_CONFIG[length];
  // Use role-specific override if available, otherwise use length-aware system prompt
  const systemPrompt = focus.claudeSystemOverride || getTrackCriticSystem(length);
  const userMessage = buildTrackReviewPrompt(input);
  const reviewMarkdown = await callClaude(systemPrompt, [
    { role: "user", content: userMessage },
  ], config.maxTokens);

  const quickTake = extractQuickTake(reviewMarkdown);
  const scores = await extractScoresStructured(reviewMarkdown);

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

  // Use summarized analysis instead of raw JSON to keep prompt manageable
  prompt += `## Audio Analysis (from the engine that listened to the track)\n\n`;
  prompt += summarizeAudioAnalysis(input.audioAnalysis);
  prompt += `\n\n`;

  if (input.lyrics) {
    prompt += `## Lyrics (provided by artist)\n\n${input.lyrics}\n\n`;
  }

  if (input.intentNotes) {
    prompt += `## Artist's Intent\n\n${input.intentNotes}\n\n`;
  }

  if (input.genre) {
    prompt += `## Detected Genre\n\n**Genre:** ${input.genre}\n\nUse this genre context to inform your critique naturally. Reference genre-specific conventions, production standards, and comparable artists/tracks within this space. Evaluate the track against the expectations and standards of this genre — but don't be heavy-handed about it. Let the genre inform your vocabulary, reference points, and what "good" looks like for this style of music.\n\n`;
  }

  if (input.referenceArtists) {
    prompt += `**Reference artists:** ${input.referenceArtists}\n`;
  }

  // Inject custom template focus areas if provided
  if (input.templateFocusAreas?.length) {
    prompt += `\n## Custom Focus Areas (from user's review template)\n\n`;
    prompt += `The user has requested you pay special attention to these areas:\n`;
    input.templateFocusAreas.forEach((area, i) => {
      prompt += `${i + 1}. **${area}**\n`;
    });
    prompt += `\nPlease ensure your review addresses each of these focus areas with specific, actionable feedback. Dedicate a subsection or paragraph to each one within your review.\n`;
  }

  if (focus.label !== "Full Review") {
    prompt += `\n**IMPORTANT: This review is for a ${focus.label}. Focus your critique on: ${focus.description}. Use the scoring dimensions: ${focus.scoringDimensions.join(", ")}. Structure your output with these sections: ${focus.outputSections.join(", ")}.`;
  }

  // Smart re-review: include previous review context
  if (input.previousReview) {
    const prev = input.previousReview;
    const prevScoresSummary = Object.entries(prev.scores)
      .map(([k, v]) => `${k}: ${v}/10`)
      .join(", ");
    prompt += `\n\n## Previous Review Context (v${prev.reviewVersion})\n\n`;
    prompt += `This track was previously reviewed. Here is what you said last time:\n\n`;
    prompt += `**Previous Scores:** ${prevScoresSummary}\n\n`;
    if (prev.quickTake) {
      prompt += `**Previous Quick Take:** ${prev.quickTake.substring(0, 1000)}\n\n`;
    }
    prompt += `**Previous Review (excerpt):**\n${prev.reviewMarkdown.substring(0, 3000)}\n\n`;
    prompt += `**IMPORTANT RE-REVIEW INSTRUCTIONS:** This is a follow-up review of the same track. You MUST:\n`;
    prompt += `1. Note what has changed since the last review (if anything is audibly different)\n`;
    prompt += `2. Call out whether your previous suggestions were addressed\n`;
    prompt += `3. Identify any improvements or regressions compared to the last review\n`;
    prompt += `4. Start your Quick Take with "**Re-review (v${prev.reviewVersion + 1}):**" to signal this is a follow-up\n`;
    prompt += `5. Be honest about whether the track has actually improved — don't inflate scores just because it's a re-review\n`;
  }

  const lengthConfig = REVIEW_LENGTH_CONFIG[input.reviewLength || "standard"];
  prompt += `\n\nNow write your full review. Be specific, reference timestamps and sections from the audio analysis, and provide actionable feedback. Remember: keep it between ${lengthConfig.wordRange} words, write each section exactly once, and use the exact table format specified for scores.`;

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
    prompt += summarizeAudioAnalysis(tr.audioAnalysis);
    prompt += `\n\n`;
    if (tr.lyrics) {
      prompt += `**Lyrics excerpt:** ${tr.lyrics.substring(0, 500)}\n\n`;
    }
    // Include a brief excerpt of the review, not the full thing
    prompt += `**Review excerpt:** ${tr.reviewMarkdown.substring(0, 800)}\n\n---\n\n`;
  }

  prompt += `\nNow write your full album review. Evaluate the project as a cohesive body of work. Keep it between 2000-4000 words, write each section exactly once, and use the exact table format for scores.`;

  const reviewMarkdown = await callClaude(ALBUM_CRITIC_SYSTEM, [
    { role: "user", content: prompt },
  ], 6000);

  const scores = await extractScoresStructured(reviewMarkdown);
  return { reviewMarkdown, scores };
}

// ── Version Comparison ──

export interface VersionComparisonInput {
  trackTitle: string;
  v1Analysis: GeminiAudioAnalysis;
  v2Analysis: GeminiAudioAnalysis;
  v1Review?: string;
  v2Review?: string;
  geminiComparison?: string;
  reviewFocus?: ReviewFocusRole;
}

export async function generateVersionComparison(input: VersionComparisonInput): Promise<string> {
  let prompt = `# Version Comparison: "${input.trackTitle}"\n\n`;
  prompt += `## Version 1 Audio Analysis\n${summarizeAudioAnalysis(input.v1Analysis)}\n\n`;
  prompt += `## Version 2 Audio Analysis\n${summarizeAudioAnalysis(input.v2Analysis)}\n\n`;

  if (input.geminiComparison) {
    prompt += `## Audio Comparison (from the engine that listened to both versions)\n\n${input.geminiComparison}\n\n`;
  }

  if (input.v1Review) {
    prompt += `## Version 1 Review Excerpt\n${input.v1Review.substring(0, 1500)}\n\n`;
  }
  if (input.v2Review) {
    prompt += `## Version 2 Review Excerpt\n${input.v2Review.substring(0, 1500)}\n\n`;
  }

  prompt += `\nCompare these two versions. What improved? What regressed? Keep it between 1000-2000 words.`;

  return callClaude(COMPARISON_CRITIC_SYSTEM, [
    { role: "user", content: prompt },
  ], 3000);
}

// ── Follow-up Conversation ──

export async function generateFollowUp(
  reviewContext: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  userQuestion: string
): Promise<string> {
  const systemPrompt = `You are the same music critic who wrote the review below. The artist is asking follow-up questions. Answer with the same specificity and honesty as the original review. Reference the audio analysis data when relevant. Be concise but thorough. Keep responses under 500 words.

ORIGINAL REVIEW AND CONTEXT:
${reviewContext.substring(0, 6000)}`;

  const messages: ClaudeMessage[] = [
    ...conversationHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userQuestion },
  ];

  return callClaude(systemPrompt, messages, 2048);
}

// ── Reference Track Comparison ──

export async function generateReferenceComparison(
  trackTitle: string,
  trackAnalysis: GeminiAudioAnalysis,
  referenceAnalysis: GeminiAudioAnalysis,
  geminiComparison: string,
  reviewFocus?: ReviewFocusRole
): Promise<string> {
  const systemPrompt = `You are a music producer and mixing engineer comparing an artist's track against a reference track. Help the artist understand how their track compares and what specific changes would close the gap.

Keep your comparison between 1000-2000 words. Be specific, reference timestamps, and provide actionable advice.

Output format:
1. **At a Glance** (key differences in 3-5 bullets)
2. **Production Comparison** (mix, dynamics, frequency balance)
3. **Arrangement Comparison** (structure, density, transitions)
4. **What the Reference Does Better** (specific observations)
5. **What Your Track Does Better** (acknowledge strengths)
6. **Closing the Gap** (prioritized list of changes)`;

  let prompt = `# Reference Track Comparison\n\n`;
  prompt += `**Your Track:** "${trackTitle}"\n\n`;
  prompt += `## Your Track Analysis\n${summarizeAudioAnalysis(trackAnalysis)}\n\n`;
  prompt += `## Reference Track Analysis\n${summarizeAudioAnalysis(referenceAnalysis)}\n\n`;
  prompt += `## Audio Comparison (from the engine that listened to both)\n\n${geminiComparison}\n\n`;
  prompt += `\nNow write your detailed comparison.`;

  return callClaude(systemPrompt, [{ role: "user", content: prompt }], 3000);
}

// ── Utility: Extract Quick Take ──

function extractQuickTake(markdown: string): string {
  // Look for the Quick Take section with 2 or 3 # headings
  const quickTakeMatch = markdown.match(/#{2,3}\s*\*?\*?Quick Take\*?\*?\s*\n([\s\S]*?)(?=\n#{2,3}\s|$)/i);
  if (quickTakeMatch) {
    return quickTakeMatch[1].trim().substring(0, 3000);
  }
  // Fallback: extract first paragraph (up to first heading)
  const firstHeading = markdown.indexOf('###');
  if (firstHeading > 50) {
    return markdown.substring(0, firstHeading).trim().substring(0, 2000);
  }
  // Last fallback: first 1000 chars
  return markdown.substring(0, 1000);
}

// ── Utility: Extract Scores (Structured JSON via second Claude call) ──

const SCORE_EXTRACTION_SCHEMA = {
  type: "object" as const,
  properties: {
    songwriting: { type: "number" as const, description: "Songwriting/composition score 1-10" },
    melody: { type: "number" as const, description: "Melody & hooks score 1-10" },
    structure: { type: "number" as const, description: "Arrangement/structure score 1-10" },
    lyrics: { type: "number" as const, description: "Lyrical content score 1-10" },
    performance: { type: "number" as const, description: "Performance/delivery score 1-10" },
    production: { type: "number" as const, description: "Production & mix quality score 1-10" },
    originality: { type: "number" as const, description: "Originality/creativity score 1-10" },
    commercial: { type: "number" as const, description: "Commercial potential score 1-10" },
    overall: { type: "number" as const, description: "Overall score 1-10" },
  },
  required: ["songwriting", "melody", "structure", "performance", "production", "originality", "commercial", "overall"] as const,
  additionalProperties: false as const,
};

/**
 * Extract scores using a structured JSON call to Claude.
 * Falls back to regex extraction if the structured call fails.
 */
export async function extractScoresStructured(reviewMarkdown: string): Promise<Record<string, number>> {
  try {
    const response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: "system",
            content: "You are a score extraction tool. Given a music review, extract the numerical scores (1-10) for each dimension. If a dimension is not mentioned, estimate it from context. All scores must be integers between 1 and 10.",
          },
          {
            role: "user",
            content: `Extract the scores from this music review:\n\n${reviewMarkdown.substring(0, 4000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "review_scores",
            strict: true,
            schema: SCORE_EXTRACTION_SCHEMA,
          },
        },
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      if (content) {
        const parsed = typeof content === "string" ? JSON.parse(content) : content;
        // Validate, clamp to 1-10, and normalize keys to camelCase
        const scores: Record<string, number> = {};
        for (const [key, val] of Object.entries(parsed)) {
          const num = typeof val === "number" ? val : parseFloat(val as string);
          if (!isNaN(num)) {
            // Normalize key: "Overall" → "overall", "Melody & Hooks" → "melodyHooks"
            const normalizedKey = key
              .replace(/[&]/g, "And")
              .replace(/[^a-zA-Z0-9\s]/g, "")
              .trim()
              .split(/\s+/)
              .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join("");
            scores[normalizedKey] = Math.round(Math.max(1, Math.min(10, num)));
          }
        }
        if (Object.keys(scores).length >= 3) {
          console.log(`[ScoreExtraction] Structured extraction succeeded: ${Object.keys(scores).length} scores`);
          return scores;
        }
      }
    }
  } catch (err) {
    console.warn("[ScoreExtraction] Structured extraction failed, falling back to regex:", err);
  }

  // Fallback to regex extraction
  return extractScores(reviewMarkdown);
}

/**
 * Regex-based score extraction (fallback).
 */
export function extractScores(markdown: string): Record<string, number> {
  const scores: Record<string, number> = {};
  
  // Strategy 1: Parse markdown table rows like "| Songwriting | 7 | reason |"
  const tableRowRegex = /\|\s*([^|]+?)\s*\|\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10\s*)?\|\s*([^|]*)\|/g;
  const tableMatches = Array.from(markdown.matchAll(tableRowRegex));
  
  for (const match of tableMatches) {
    const label = match[1].trim().toLowerCase();
    const value = parseFloat(match[2]);
    
    if (value < 1 || value > 10) continue;
    if (label.includes("component") || label.includes("---") || label.includes("score")) continue;
    
    // Map various label formats to canonical keys
    if (label.includes("songwriting") || label.includes("composition")) scores.songwriting = value;
    else if (label.includes("melody") || label.includes("hook")) scores.melody = value;
    else if (label.includes("arrangement") || label.includes("structure")) scores.structure = value;
    else if (label.includes("lyric")) scores.lyrics = value;
    else if (label.includes("performance") || label.includes("delivery") || label.includes("vocal")) scores.performance = value;
    else if (label.includes("production") || label.includes("mix")) scores.production = value;
    else if (label.includes("originality") || label.includes("creativity")) scores.originality = value;
    else if (label.includes("commercial")) scores.commercial = value;
    else if (label.includes("overall")) scores.overall = value;
    else if (label.includes("emotional") || label.includes("impact")) scores.emotionalImpact = value;
    else if (label.includes("cohesion")) scores.cohesion = value;
    else if (label.includes("sequencing")) scores.sequencing = value;
    else {
      const key = label.replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
      if (key.length > 0 && key.length < 30) scores[key] = value;
    }
  }
  
  // Strategy 2: Fallback regex patterns for non-table formats
  if (Object.keys(scores).length === 0) {
    const patterns: Array<[RegExp, string]> = [
      [/songwriting[^:]*:\s*(\d+(?:\.\d+)?)/i, "songwriting"],
      [/melody[^:]*:\s*(\d+(?:\.\d+)?)/i, "melody"],
      [/arrangement[^:]*:\s*(\d+(?:\.\d+)?)/i, "structure"],
      [/lyrics?[^:]*:\s*(\d+(?:\.\d+)?)/i, "lyrics"],
      [/performance[^:]*:\s*(\d+(?:\.\d+)?)/i, "performance"],
      [/production[^:]*:\s*(\d+(?:\.\d+)?)/i, "production"],
      [/originality[^:]*:\s*(\d+(?:\.\d+)?)/i, "originality"],
      [/commercial[^:]*:\s*(\d+(?:\.\d+)?)/i, "commercial"],
      [/overall[^:]*:\s*(\d+(?:\.\d+)?)/i, "overall"],
    ];
    
    for (const [regex, key] of patterns) {
      const m = markdown.match(regex);
      if (m) {
        const val = parseFloat(m[1]);
        if (val >= 1 && val <= 10) scores[key] = val;
      }
    }
  }

  return scores;
}
