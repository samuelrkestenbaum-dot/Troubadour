/**
 * Instrumentation Advisor Service
 * Uses Claude 4.5 to analyze existing track sections and suggest instrument types,
 * part types, and arrangement improvements to reach a target sonic state.
 * 
 * Gemini listens to the audio → provides sections, instrumentation, arrangement data
 * Claude 4.5 reasons about what's missing → suggests instruments and parts per section
 */
import { callClaude } from "./claudeCritic";
import type { GeminiAudioAnalysis } from "./geminiAudio";

// ── Target States ──

export const TARGET_STATES = {
  fuller: {
    label: "Fuller Arrangement",
    description: "Add depth and richness — more layers, harmonic support, textural variety",
    icon: "layers",
  },
  stripped: {
    label: "Stripped-Back",
    description: "Identify what to remove for a more intimate, focused arrangement",
    icon: "minimize",
  },
  radioReady: {
    label: "Radio-Ready",
    description: "Optimize for commercial appeal — energy, hooks, production polish",
    icon: "radio",
  },
  cinematic: {
    label: "Cinematic / Epic",
    description: "Build toward dramatic, film-score-inspired arrangement with dynamic peaks",
    icon: "film",
  },
  liveReady: {
    label: "Live Performance Ready",
    description: "Adapt arrangement for a live band setting — practical instrument choices",
    icon: "mic",
  },
  electronic: {
    label: "Electronic / Synth-Forward",
    description: "Push toward synthesized textures, programmed drums, and digital production",
    icon: "cpu",
  },
} as const;

export type TargetState = keyof typeof TARGET_STATES;

// ── Output Types ──

export interface InstrumentSuggestion {
  instrument: string;
  partType: string;
  role: string;
  priority: "essential" | "recommended" | "optional";
  reasoning: string;
  technique?: string;
}

export interface SectionAdvice {
  sectionName: string;
  startTime: string;
  endTime: string;
  energy: number;
  currentInstruments: string[];
  suggestions: InstrumentSuggestion[];
  removalSuggestions: string[];
  arrangementNote: string;
}

export interface InstrumentationAdvice {
  trackTitle: string;
  genre: string;
  targetState: TargetState;
  targetLabel: string;
  overallStrategy: string;
  sections: SectionAdvice[];
  globalSuggestions: InstrumentSuggestion[];
  arrangementArc: string;
  keyTakeaway: string;
}

// ── Input ──

export interface InstrumentationAdvisorInput {
  trackTitle: string;
  genre: string;
  targetState: TargetState;
  audioAnalysis: GeminiAudioAnalysis;
  lyrics?: string;
  artistNotes?: string;
}

// ── Core Function ──

export async function generateInstrumentationAdvice(
  input: InstrumentationAdvisorInput
): Promise<InstrumentationAdvice> {
  const target = TARGET_STATES[input.targetState];

  const systemPrompt = `You are a world-class music arranger, orchestrator, and producer with deep expertise across all genres. You specialize in instrumentation — knowing exactly which instruments, parts, and textures will elevate a track toward a specific sonic goal.

Your role is to analyze what instruments and parts are already present in each section of a song, then suggest specific additions, modifications, or removals to reach the artist's target arrangement state.

Rules:
- Be genre-aware: suggest instruments that fit the genre naturally
- Be section-aware: different sections need different instrumentation density
- Be practical: suggest real, achievable parts a musician or producer could implement
- Tempo is FIXED at ${input.audioAnalysis.tempo.bpm} BPM — never suggest tempo changes
- Prioritize suggestions as "essential", "recommended", or "optional"
- For each instrument suggestion, specify the part type (e.g., "pad", "arpeggio", "staccato rhythm", "melody doubling", "counter-melody", "bass fill", "percussive accent")
- Include technique hints when relevant (e.g., "palm-muted", "fingerpicked", "legato strings", "sidechain compressed")
- Consider the arrangement arc — how instrumentation should build and release across the full song

Return ONLY valid JSON matching the schema below. No markdown fences.`;

  const userMessage = buildAdvisorPrompt(input, target);

  const response = await callClaude(systemPrompt, [{ role: "user", content: userMessage }], 6000);

  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as InstrumentationAdvice;
    // Ensure metadata is correct
    parsed.trackTitle = input.trackTitle;
    parsed.genre = input.genre;
    parsed.targetState = input.targetState;
    parsed.targetLabel = target.label;
    return parsed;
  } catch (err) {
    // Fallback: return a minimal valid response
    return {
      trackTitle: input.trackTitle,
      genre: input.genre,
      targetState: input.targetState,
      targetLabel: target.label,
      overallStrategy: "Unable to parse AI response. Please try again.",
      sections: input.audioAnalysis.sections?.map(s => ({
        sectionName: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        energy: s.energy,
        currentInstruments: s.musicalElements || [],
        suggestions: [],
        removalSuggestions: [],
        arrangementNote: s.description,
      })) || [],
      globalSuggestions: [],
      arrangementArc: "",
      keyTakeaway: "Analysis could not be completed. Please retry.",
    };
  }
}

// ── Prompt Builder ──

function buildAdvisorPrompt(
  input: InstrumentationAdvisorInput,
  target: typeof TARGET_STATES[TargetState]
): string {
  const { audioAnalysis } = input;

  let prompt = `# Instrumentation Advisor Request\n\n`;
  prompt += `**Track:** "${input.trackTitle}"\n`;
  prompt += `**Genre:** ${input.genre}\n`;
  prompt += `**Target State:** ${target.label} — ${target.description}\n`;
  prompt += `**Tempo:** ${audioAnalysis.tempo.bpm} BPM (${audioAnalysis.tempo.feel}) — FIXED, do not suggest changes\n`;
  prompt += `**Key:** ${audioAnalysis.key.estimated} (${audioAnalysis.key.modality})\n`;
  prompt += `**Duration:** ~${audioAnalysis.estimatedDuration}s\n\n`;

  // Current instrumentation
  prompt += `## Currently Detected Instruments\n`;
  prompt += `${audioAnalysis.instrumentation?.join(", ") || "None detected"}\n\n`;

  // Current arrangement
  prompt += `## Current Arrangement\n`;
  prompt += `- **Density:** ${audioAnalysis.arrangement.density}\n`;
  prompt += `- **Layering:** ${audioAnalysis.arrangement.layering}\n`;
  prompt += `- **Transitions:** ${audioAnalysis.arrangement.transitions}\n`;
  prompt += `- **Build & Release:** ${audioAnalysis.arrangement.buildAndRelease}\n\n`;

  // Energy profile
  prompt += `## Energy Profile\n`;
  prompt += `- **Overall:** ${audioAnalysis.energy.overall}\n`;
  prompt += `- **Dynamic Range:** ${audioAnalysis.energy.dynamicRange}\n\n`;

  // Sections with current elements
  prompt += `## Sections (with current musical elements)\n\n`;
  if (audioAnalysis.sections?.length) {
    for (const s of audioAnalysis.sections) {
      prompt += `### ${s.name} (${s.startTime}–${s.endTime}) — Energy: ${s.energy}/10\n`;
      prompt += `${s.description}\n`;
      prompt += `**Current elements:** ${s.musicalElements?.join(", ") || "None specified"}\n\n`;
    }
  } else {
    prompt += `No sections detected.\n\n`;
  }

  // Production context
  prompt += `## Production Context\n`;
  prompt += `- **Mix Quality:** ${audioAnalysis.production.mixQuality}\n`;
  prompt += `- **Spatial:** ${audioAnalysis.production.spatialCharacteristics}\n`;
  prompt += `- **Frequency Balance:** ${audioAnalysis.production.frequencyBalance}\n`;
  if (audioAnalysis.production.notableEffects?.length) {
    prompt += `- **Effects:** ${audioAnalysis.production.notableEffects.join(", ")}\n`;
  }
  prompt += `\n`;

  // Melodic context
  prompt += `## Melodic Context\n`;
  prompt += `- **Hook Strength:** ${audioAnalysis.melodicAnalysis.hookStrength}\n`;
  prompt += `- **Vocal Characteristics:** ${audioAnalysis.melodicAnalysis.vocalCharacteristics}\n\n`;

  // Rhythmic context
  prompt += `## Rhythmic Context\n`;
  prompt += `- **Groove:** ${audioAnalysis.rhythmicAnalysis.groove}\n`;
  prompt += `- **Density:** ${audioAnalysis.rhythmicAnalysis.rhythmicDensity}\n`;
  prompt += `- **Variation:** ${audioAnalysis.rhythmicAnalysis.rhythmicVariation}\n\n`;

  // Strengths and weaknesses
  if (audioAnalysis.strengths?.length) {
    prompt += `## Current Strengths\n${audioAnalysis.strengths.join("; ")}\n\n`;
  }
  if (audioAnalysis.weaknesses?.length) {
    prompt += `## Current Weaknesses\n${audioAnalysis.weaknesses.join("; ")}\n\n`;
  }

  // Artist notes
  if (input.artistNotes) {
    prompt += `## Artist's Notes\n${input.artistNotes}\n\n`;
  }

  // Lyrics context
  if (input.lyrics) {
    prompt += `## Lyrics (for emotional context)\n${input.lyrics.substring(0, 1500)}\n\n`;
  }

  // JSON schema
  prompt += `## Required JSON Output

{
  "overallStrategy": "2-3 sentence strategy for reaching the target state from current arrangement",
  "sections": [
    {
      "sectionName": "section name matching the detected sections above",
      "startTime": "M:SS",
      "endTime": "M:SS",
      "energy": <1-10>,
      "currentInstruments": ["instruments currently in this section"],
      "suggestions": [
        {
          "instrument": "specific instrument name (e.g., 'Rhodes electric piano', 'fingerpicked acoustic guitar', 'orchestral strings section')",
          "partType": "what kind of part (e.g., 'sustained pad', 'rhythmic stab', 'arpeggio', 'counter-melody', 'bass fill', 'percussive accent', 'harmonic support')",
          "role": "what this adds to the section (e.g., 'fills the mid-frequency gap', 'adds rhythmic drive', 'creates emotional lift')",
          "priority": "essential|recommended|optional",
          "reasoning": "why this instrument/part works here specifically",
          "technique": "optional playing/production technique hint"
        }
      ],
      "removalSuggestions": ["instruments/elements to consider removing for this target state, empty array if none"],
      "arrangementNote": "brief note on how this section's role changes in the target arrangement"
    }
  ],
  "globalSuggestions": [
    {
      "instrument": "instrument that should be present throughout or across multiple sections",
      "partType": "part type",
      "role": "role in the overall arrangement",
      "priority": "essential|recommended|optional",
      "reasoning": "why this is needed globally",
      "technique": "optional technique hint"
    }
  ],
  "arrangementArc": "describe how the instrumentation should build and evolve across the full song to reach the target state",
  "keyTakeaway": "single most impactful change the artist should make first"
}

Provide suggestions for EVERY detected section. Be specific about instrument names and part types. Aim for 2-5 suggestions per section depending on how much change is needed.`;

  return prompt;
}
