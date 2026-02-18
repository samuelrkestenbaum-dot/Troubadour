import { describe, it, expect, vi, beforeEach } from "vitest";
import { TARGET_STATES, type TargetState, type InstrumentationAdvisorInput, type InstrumentationAdvice } from "./instrumentationAdvisor";

// Mock callClaude
vi.mock("./claudeCritic", () => ({
  callClaude: vi.fn(),
}));

// ── Fixture data ──
const mockGeminiAnalysis = {
  tempo: { bpm: 120, feel: "steady" },
  key: { estimated: "C major", modality: "major" },
  estimatedDuration: 210,
  instrumentation: ["acoustic guitar", "vocals", "bass guitar", "drums"],
  arrangement: {
    density: "moderate",
    layering: "3-4 layers",
    transitions: "smooth crossfades",
    buildAndRelease: "gradual build to chorus",
  },
  energy: {
    overall: "medium-high",
    dynamicRange: "moderate",
    curve: [3, 5, 7, 8, 6, 4],
  },
  sections: [
    {
      name: "Intro",
      startTime: "0:00",
      endTime: "0:15",
      energy: 3,
      description: "Gentle acoustic guitar opening",
      musicalElements: ["acoustic guitar", "light reverb"],
    },
    {
      name: "Verse 1",
      startTime: "0:15",
      endTime: "1:00",
      energy: 5,
      description: "Vocals enter with guitar and bass",
      musicalElements: ["acoustic guitar", "vocals", "bass guitar"],
    },
    {
      name: "Chorus",
      startTime: "1:00",
      endTime: "1:30",
      energy: 8,
      description: "Full band with driving drums",
      musicalElements: ["acoustic guitar", "vocals", "bass guitar", "drums", "tambourine"],
    },
    {
      name: "Outro",
      startTime: "3:00",
      endTime: "3:30",
      energy: 4,
      description: "Fade out with guitar",
      musicalElements: ["acoustic guitar"],
    },
  ],
  production: {
    mixQuality: "clean and balanced",
    spatialCharacteristics: "moderate stereo width",
    frequencyBalance: "slightly mid-heavy",
    notableEffects: ["reverb", "light compression"],
  },
  melodicAnalysis: {
    hookStrength: "strong chorus hook",
    vocalCharacteristics: "warm baritone",
  },
  rhythmicAnalysis: {
    groove: "straight 4/4",
    rhythmicDensity: "moderate",
    rhythmicVariation: "consistent",
  },
  strengths: ["Strong melodic hook", "Good vocal performance"],
  weaknesses: ["Mid-frequency buildup", "Sparse verse arrangement"],
  genre: { primary: "Indie Folk" },
};

const mockClaudeResponse: InstrumentationAdvice = {
  trackTitle: "Test Track",
  genre: "Indie Folk",
  targetState: "fuller" as TargetState,
  targetLabel: "Fuller Arrangement",
  overallStrategy: "Add harmonic support and textural layers to fill the mid-range gap. Focus on warm pad sounds in verses and rhythmic elements in choruses.",
  sections: [
    {
      sectionName: "Intro",
      startTime: "0:00",
      endTime: "0:15",
      energy: 3,
      currentInstruments: ["acoustic guitar", "light reverb"],
      suggestions: [
        {
          instrument: "Rhodes electric piano",
          partType: "sustained pad",
          role: "fills the mid-frequency gap with warmth",
          priority: "recommended",
          reasoning: "The intro is sparse — a gentle Rhodes pad underneath the guitar creates depth without competing",
          technique: "soft sustain pedal, low velocity",
        },
      ],
      removalSuggestions: [],
      arrangementNote: "Keep the intimacy but add a subtle harmonic bed",
    },
    {
      sectionName: "Verse 1",
      startTime: "0:15",
      endTime: "1:00",
      energy: 5,
      currentInstruments: ["acoustic guitar", "vocals", "bass guitar"],
      suggestions: [
        {
          instrument: "fingerpicked electric guitar",
          partType: "arpeggio",
          role: "adds rhythmic movement and mid-range texture",
          priority: "essential",
          reasoning: "The verse needs more rhythmic interest to carry the listener to the chorus",
          technique: "clean tone, light chorus effect",
        },
        {
          instrument: "shaker",
          partType: "percussive accent",
          role: "provides subtle rhythmic drive",
          priority: "optional",
          reasoning: "A shaker can add forward momentum without full drums",
        },
      ],
      removalSuggestions: [],
      arrangementNote: "Build gradually — introduce elements one at a time",
    },
    {
      sectionName: "Chorus",
      startTime: "1:00",
      endTime: "1:30",
      energy: 8,
      currentInstruments: ["acoustic guitar", "vocals", "bass guitar", "drums", "tambourine"],
      suggestions: [
        {
          instrument: "orchestral strings section",
          partType: "sustained pad",
          role: "creates emotional lift and fullness",
          priority: "recommended",
          reasoning: "Strings add cinematic weight to the chorus peak",
          technique: "legato, swell from pp to mf",
        },
      ],
      removalSuggestions: [],
      arrangementNote: "This is the emotional peak — maximize layering",
    },
    {
      sectionName: "Outro",
      startTime: "3:00",
      endTime: "3:30",
      energy: 4,
      currentInstruments: ["acoustic guitar"],
      suggestions: [],
      removalSuggestions: [],
      arrangementNote: "Keep stripped back for emotional contrast with the chorus",
    },
  ],
  globalSuggestions: [
    {
      instrument: "reverb bus",
      partType: "spatial effect",
      role: "unifies all instruments in a cohesive acoustic space",
      priority: "essential",
      reasoning: "A shared reverb creates the 'room' feel that ties the arrangement together",
      technique: "medium hall, 1.5s decay, low pre-delay",
    },
  ],
  arrangementArc: "Start intimate with guitar only, layer in Rhodes and electric guitar through verses, peak with full band plus strings in choruses, then strip back to guitar for the outro. The arc should feel like a wave.",
  keyTakeaway: "Add a fingerpicked electric guitar arpeggio in the verses — this single change will transform the sparse verse into something that carries momentum toward the chorus.",
};

function makeInput(overrides?: Partial<InstrumentationAdvisorInput>): InstrumentationAdvisorInput {
  return {
    trackTitle: "Test Track",
    genre: "Indie Folk",
    targetState: "fuller",
    audioAnalysis: mockGeminiAnalysis as any,
    ...overrides,
  };
}

describe("Instrumentation Advisor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TARGET_STATES", () => {
    it("defines 6 target states", () => {
      expect(Object.keys(TARGET_STATES)).toHaveLength(6);
    });

    it("includes all expected target states", () => {
      const keys = Object.keys(TARGET_STATES);
      expect(keys).toContain("fuller");
      expect(keys).toContain("stripped");
      expect(keys).toContain("radioReady");
      expect(keys).toContain("cinematic");
      expect(keys).toContain("liveReady");
      expect(keys).toContain("electronic");
    });

    it("each target state has label, description, and icon", () => {
      for (const [key, val] of Object.entries(TARGET_STATES)) {
        expect(val.label).toBeTruthy();
        expect(val.description).toBeTruthy();
        expect(val.icon).toBeTruthy();
      }
    });
  });

  describe("generateInstrumentationAdvice", () => {
    it("returns advice with correct metadata when Claude responds with valid JSON", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      const input = makeInput();
      const result = await generateInstrumentationAdvice(input);

      expect(result.trackTitle).toBe("Test Track");
      expect(result.genre).toBe("Indie Folk");
      expect(result.targetState).toBe("fuller");
      expect(result.targetLabel).toBe("Fuller Arrangement");
    });

    it("returns section-level advice for each detected section", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      const result = await generateInstrumentationAdvice(makeInput());

      expect(result.sections).toHaveLength(4);
      expect(result.sections[0].sectionName).toBe("Intro");
      expect(result.sections[1].sectionName).toBe("Verse 1");
      expect(result.sections[2].sectionName).toBe("Chorus");
      expect(result.sections[3].sectionName).toBe("Outro");
    });

    it("includes instrument suggestions with priority, partType, and reasoning", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      const result = await generateInstrumentationAdvice(makeInput());

      const verse = result.sections[1];
      expect(verse.suggestions).toHaveLength(2);
      expect(verse.suggestions[0].instrument).toBe("fingerpicked electric guitar");
      expect(verse.suggestions[0].partType).toBe("arpeggio");
      expect(verse.suggestions[0].priority).toBe("essential");
      expect(verse.suggestions[0].reasoning).toBeTruthy();
    });

    it("includes global suggestions", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      const result = await generateInstrumentationAdvice(makeInput());

      expect(result.globalSuggestions).toHaveLength(1);
      expect(result.globalSuggestions[0].instrument).toBe("reverb bus");
    });

    it("includes overallStrategy, arrangementArc, and keyTakeaway", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      const result = await generateInstrumentationAdvice(makeInput());

      expect(result.overallStrategy).toContain("harmonic support");
      expect(result.arrangementArc).toContain("intimate");
      expect(result.keyTakeaway).toContain("fingerpicked electric guitar");
    });

    it("handles Claude response wrapped in markdown fences", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce("```json\n" + JSON.stringify(mockClaudeResponse) + "\n```");

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      const result = await generateInstrumentationAdvice(makeInput());

      expect(result.trackTitle).toBe("Test Track");
      expect(result.sections).toHaveLength(4);
    });

    it("returns fallback response when Claude returns invalid JSON", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce("This is not valid JSON at all");

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      const result = await generateInstrumentationAdvice(makeInput());

      expect(result.trackTitle).toBe("Test Track");
      expect(result.genre).toBe("Indie Folk");
      expect(result.targetState).toBe("fuller");
      expect(result.overallStrategy).toContain("Unable to parse");
      expect(result.sections).toHaveLength(4); // Falls back to Gemini sections
    });

    it("passes artist notes to Claude when provided", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      await generateInstrumentationAdvice(makeInput({
        artistNotes: "Keep the acoustic guitar prominent",
      }));

      expect(callClaude).toHaveBeenCalledTimes(1);
      const userMessage = (callClaude as any).mock.calls[0][1][0].content;
      expect(userMessage).toContain("Keep the acoustic guitar prominent");
    });

    it("passes lyrics context to Claude when provided", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      await generateInstrumentationAdvice(makeInput({
        lyrics: "Walking down the road, feeling the wind blow...",
      }));

      const userMessage = (callClaude as any).mock.calls[0][1][0].content;
      expect(userMessage).toContain("Walking down the road");
    });

    it("includes tempo as FIXED in the system prompt", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      await generateInstrumentationAdvice(makeInput());

      const systemPrompt = (callClaude as any).mock.calls[0][0];
      expect(systemPrompt).toContain("120 BPM");
      expect(systemPrompt).toContain("FIXED");
      expect(systemPrompt).toContain("never suggest tempo changes");
    });

    it("requests 6000 max tokens from Claude", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce(JSON.stringify(mockClaudeResponse));

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      await generateInstrumentationAdvice(makeInput());

      expect(callClaude).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        6000
      );
    });

    it("works with all 6 target states", async () => {
      const { callClaude } = await import("./claudeCritic");
      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");

      const targets: TargetState[] = ["fuller", "stripped", "radioReady", "cinematic", "liveReady", "electronic"];

      for (const target of targets) {
        const response = { ...mockClaudeResponse, targetState: target };
        (callClaude as any).mockResolvedValueOnce(JSON.stringify(response));

        const result = await generateInstrumentationAdvice(makeInput({ targetState: target }));
        expect(result.targetState).toBe(target);
      }
    });

    it("handles empty sections gracefully in fallback", async () => {
      const { callClaude } = await import("./claudeCritic");
      (callClaude as any).mockResolvedValueOnce("invalid");

      const { generateInstrumentationAdvice } = await import("./instrumentationAdvisor");
      const result = await generateInstrumentationAdvice(makeInput({
        audioAnalysis: { ...mockGeminiAnalysis, sections: [] } as any,
      }));

      expect(result.sections).toHaveLength(0);
      expect(result.overallStrategy).toContain("Unable to parse");
    });
  });
});
