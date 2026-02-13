/**
 * Claude 4.5 Critique Generation Service
 * Uses the Forge API gateway to access Claude 4.5 Sonnet for detailed, honest music critiques
 * based on Gemini's audio analysis, lyrics, and artist context.
 */
import { ENV } from "../_core/env";
import type { GeminiAudioAnalysis } from "./geminiAudio";
import { getFocusConfig, type ReviewFocusRole } from "./reviewFocus";

export const CLAUDE_MODEL = "claude-sonnet-4-20250514";

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

export async function callClaude(systemPrompt: string, messages: ClaudeMessage[], maxTokens = 4096): Promise<string> {
  assertApiKey();

  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  const response = await fetch(resolveApiUrl(), {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
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

// ── Critic Persona System Prompt ──

const TRACK_CRITIC_SYSTEM = `You are a world-class music critic, A&R executive, and producer combined into one voice. You have decades of experience across all genres.

Your review style:
- HONEST and SPECIFIC. Never generic. Never sycophantic.
- You cite concrete musical moments using timestamps and section names from the analysis data.
- You differentiate clearly between songwriting, production, performance, and arrangement.
- You give actionable, prioritized feedback — not vague encouragement.
- You write like someone who genuinely cares about the artist's development.
- You acknowledge what works before addressing what doesn't.
- You think commercially but respect artistry.

CRITICAL OUTPUT RULES:
- Keep your review between 1500-3000 words. Be concise but thorough.
- DO NOT repeat sections. Write each section exactly once.
- For the Scores table, use this EXACT format (no extra spaces):

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

Your output sections:
1. **Quick Take** (3-6 bullet points — the TL;DR)
2. **Scores** (table as shown above — compact, no padding)
3. **Section-by-Section Notes** (reference timestamps)
4. **Hook & Melodic Analysis**
5. **Production Notes**
6. **Songwriting Assessment**
7. **Highest Leverage Changes** (ranked list — what would improve this track the most)
8. **Next Iteration Checklist** (specific, actionable experiments to try)

Be direct. Be helpful. Be the critic every artist needs but rarely gets.`;

const ALBUM_CRITIC_SYSTEM = `You are a senior A&R executive and album producer with decades of experience shaping records. You understand album craft — sequencing, arc, cohesion, and the art of the full-length project.

Keep your review between 2000-4000 words. Do NOT repeat sections.

For scores, use this EXACT format:
| Component | Score | Justification |
|---|---|---|
| Category | 7 | Brief reason |

Output sections:
1. **Executive Summary** (2-3 paragraphs)
2. **Track Rankings** (strongest to weakest)
3. **Singles Recommendation** (1-3 tracks)
4. **Sequencing Analysis** (current order + suggested reorder)
5. **Cohesion & Arc Assessment**
6. **Market Positioning**
7. **A&R Recommendations**
8. **Album Score** (overall rating with breakdown table)

Be direct, strategic, and honest.`;

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
  ], 4096);

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

  if (focus.label !== "Full Review") {
    prompt += `\n**IMPORTANT: This review is for a ${focus.label}. Focus your critique on: ${focus.description}. Use the scoring dimensions: ${focus.scoringDimensions.join(", ")}. Structure your output with these sections: ${focus.outputSections.join(", ")}.`;
  }

  prompt += `\n\nNow write your full review. Be specific, reference timestamps and sections from the audio analysis, and provide actionable feedback. Remember: keep it between 1500-3000 words, write each section exactly once, and use the exact table format specified for scores.`;

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

  const scores = extractScores(reviewMarkdown);
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

// ── Utility: Extract Scores ──

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
    // Generic fallback: use cleaned label as key
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
