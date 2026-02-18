/**
 * Signature Sound Advisor Service
 * Uses Claude 4.5 to analyze all tracks in an album/project and suggest
 * recurring, unifying sonic elements (a specific synth tone, reverb space,
 * delay rhythm, etc.) that create cohesion across the full body of work.
 *
 * Gemini provides per-track audio analysis → Claude 4.5 reasons about what
 * unifying elements would tie the album together while respecting each track's identity.
 */
import { callClaude } from "./claudeCritic";
import type { GeminiAudioAnalysis } from "./geminiAudio";

// ── Output Types ──

export interface SignatureElement {
  element: string;
  category: "texture" | "effect" | "rhythm" | "harmonic" | "timbral" | "spatial";
  description: string;
  howToApply: string;
  trackSpecificNotes: { trackName: string; application: string }[];
  subtlety: "very_subtle" | "subtle" | "moderate" | "prominent";
  priority: "essential" | "recommended" | "optional";
}

export interface AlbumCohesionAnalysis {
  currentCohesion: {
    score: number;
    strengths: string[];
    gaps: string[];
  };
  signatureElements: SignatureElement[];
  transitionStrategy: string;
  sequencingNotes: string;
  overallVision: string;
  keyTakeaway: string;
}

export interface SignatureSoundInput {
  projectTitle: string;
  tracks: {
    trackTitle: string;
    genre: string;
    audioAnalysis: GeminiAudioAnalysis;
    reviewQuickTake?: string;
    overallScore?: number;
  }[];
}

// ── Core Function ──

export async function generateSignatureSound(
  input: SignatureSoundInput
): Promise<AlbumCohesionAnalysis> {
  if (input.tracks.length < 2) {
    throw new Error("Need at least 2 tracks to generate signature sound advice");
  }

  const systemPrompt = `You are a world-class album producer and sonic architect. You specialize in creating cohesive albums where every track feels like it belongs to the same body of work, while maintaining each song's individual identity.

Your role is to analyze all tracks in a project and suggest 3-6 recurring, subtle sonic elements — a "signature sound" — that would unify the album. Think of how:
- Radiohead uses specific reverb spaces and textural layers across albums
- Billie Eilish uses intimate spatial design and bass textures as signatures
- The 1975 uses specific synth tones and production flourishes
- Bon Iver uses vocal processing and harmonic layering as unifying threads

Rules:
- Suggest elements that are SUBTLE enough to not dominate any track but PRESENT enough to create subconscious cohesion
- Each element should work across different tempos, keys, and energy levels
- Tempo is FIXED per track — never suggest tempo changes
- Consider the existing production style and enhance it, don't replace it
- Be specific about implementation: exact effect settings, instrument choices, processing chains
- Categories: texture (pads, noise, ambience), effect (reverb, delay, modulation), rhythm (percussion patterns, rhythmic motifs), harmonic (chord voicings, intervals), timbral (specific instrument tones), spatial (stereo field, depth)
- Rate each element's subtlety level: very_subtle (barely noticeable), subtle (noticed on close listen), moderate (clearly present), prominent (defining characteristic)

Return ONLY valid JSON matching the schema below. No markdown fences.`;

  const userMessage = buildSignatureSoundPrompt(input);

  const response = await callClaude(systemPrompt, [{ role: "user", content: userMessage }], 6000);

  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as AlbumCohesionAnalysis;
    return parsed;
  } catch (err) {
    // Fallback
    return {
      currentCohesion: {
        score: 0,
        strengths: [],
        gaps: ["Unable to parse AI response. Please try again."],
      },
      signatureElements: [],
      transitionStrategy: "",
      sequencingNotes: "",
      overallVision: "Analysis could not be completed. Please retry.",
      keyTakeaway: "Analysis could not be completed. Please retry.",
    };
  }
}

// ── Prompt Builder ──

function buildSignatureSoundPrompt(input: SignatureSoundInput): string {
  let prompt = `# Signature Sound Analysis\n\n`;
  prompt += `**Album/Project:** "${input.projectTitle}"\n`;
  prompt += `**Track Count:** ${input.tracks.length}\n\n`;

  // Per-track summaries
  prompt += `## Tracks\n\n`;
  for (let i = 0; i < input.tracks.length; i++) {
    const t = input.tracks[i];
    const a = t.audioAnalysis;
    prompt += `### ${i + 1}. "${t.trackTitle}" — ${t.genre}\n`;
    prompt += `- **Tempo:** ${a.tempo.bpm} BPM (${a.tempo.feel}) — FIXED\n`;
    prompt += `- **Key:** ${a.key.estimated} (${a.key.modality})\n`;
    prompt += `- **Instrumentation:** ${a.instrumentation?.join(", ") || "Unknown"}\n`;
    prompt += `- **Arrangement:** Density: ${a.arrangement.density}, Layering: ${a.arrangement.layering}\n`;
    prompt += `- **Energy:** Overall: ${a.energy.overall}, Dynamic Range: ${a.energy.dynamicRange}\n`;
    prompt += `- **Production:** Mix: ${a.production.mixQuality}, Spatial: ${a.production.spatialCharacteristics}\n`;
    if (a.production.notableEffects?.length) {
      prompt += `- **Effects:** ${a.production.notableEffects.join(", ")}\n`;
    }
    prompt += `- **Melodic:** Hook: ${a.melodicAnalysis.hookStrength}, Vocal: ${a.melodicAnalysis.vocalCharacteristics}\n`;
    prompt += `- **Rhythmic:** Groove: ${a.rhythmicAnalysis.groove}, Density: ${a.rhythmicAnalysis.rhythmicDensity}\n`;
    if (a.strengths?.length) {
      prompt += `- **Strengths:** ${a.strengths.slice(0, 3).join("; ")}\n`;
    }
    if (a.weaknesses?.length) {
      prompt += `- **Weaknesses:** ${a.weaknesses.slice(0, 3).join("; ")}\n`;
    }
    if (t.reviewQuickTake) {
      prompt += `- **Critic's Take:** ${t.reviewQuickTake}\n`;
    }
    if (t.overallScore !== undefined) {
      prompt += `- **Score:** ${t.overallScore}/10\n`;
    }
    prompt += `\n`;
  }

  // Common elements analysis
  const allInstruments = new Set<string>();
  const allEffects = new Set<string>();
  const genres = new Set<string>();
  for (const t of input.tracks) {
    t.audioAnalysis.instrumentation?.forEach(i => allInstruments.add(i));
    t.audioAnalysis.production.notableEffects?.forEach(e => allEffects.add(e));
    genres.add(t.genre);
  }

  prompt += `## Cross-Track Analysis\n\n`;
  prompt += `**All Instruments Used:** ${Array.from(allInstruments).join(", ") || "Unknown"}\n`;
  prompt += `**All Effects Detected:** ${Array.from(allEffects).join(", ") || "None"}\n`;
  prompt += `**Genres Represented:** ${Array.from(genres).join(", ")}\n\n`;

  // JSON schema
  prompt += `## Required JSON Output

{
  "currentCohesion": {
    "score": <1-10 how cohesive the album currently sounds>,
    "strengths": ["what already ties the tracks together"],
    "gaps": ["where cohesion breaks down"]
  },
  "signatureElements": [
    {
      "element": "specific name for this signature element (e.g., 'Warm Tape Saturation Layer', 'Slapback Delay Motif', 'Sub-bass Octave Doubling')",
      "category": "texture|effect|rhythm|harmonic|timbral|spatial",
      "description": "what this element is and why it works as a unifying thread",
      "howToApply": "specific implementation instructions — effect settings, instrument choices, processing chains, plugin suggestions",
      "trackSpecificNotes": [
        { "trackName": "track title", "application": "how to apply this element specifically to this track" }
      ],
      "subtlety": "very_subtle|subtle|moderate|prominent",
      "priority": "essential|recommended|optional"
    }
  ],
  "transitionStrategy": "how tracks should flow into each other — crossfade approaches, tonal bridges, rhythmic continuity",
  "sequencingNotes": "suggested track order considerations based on key relationships, energy flow, and thematic arc",
  "overallVision": "2-3 sentence vision statement for what this album's sonic identity should be",
  "keyTakeaway": "the single most impactful signature element to implement first"
}

Suggest 3-6 signature elements. Include trackSpecificNotes for EVERY track in the project. Be specific about implementation — producers should be able to take this directly into their DAW.`;

  return prompt;
}
