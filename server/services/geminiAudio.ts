/**
 * Gemini Audio Analysis Service
 * This is the engine that "listens to the music" — sends actual audio files
 * to Google Gemini for multimodal audio understanding and musical analysis.
 */
import { ENV } from "../_core/env";
import { getFocusConfig, type ReviewFocusRole } from "./reviewFocus";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiAudioAnalysis {
  overview: string;
  tempo: { bpm: number; confidence: string; feel: string };
  key: { estimated: string; confidence: string; modality: string };
  energy: {
    overall: string;
    curve: Array<{ timestamp: string; level: number; description: string }>;
    dynamicRange: string;
  };
  sections: Array<{
    name: string;
    startTime: string;
    endTime: string;
    description: string;
    energy: number;
    musicalElements: string[];
  }>;
  instrumentation: string[];
  production: {
    mixQuality: string;
    spatialCharacteristics: string;
    frequencyBalance: string;
    dynamicProcessing: string;
    notableEffects: string[];
  };
  melodicAnalysis: {
    hookStrength: string;
    melodicContour: string;
    vocalCharacteristics: string;
    memorability: string;
  };
  rhythmicAnalysis: {
    groove: string;
    rhythmicDensity: string;
    rhythmicVariation: string;
  };
  arrangement: {
    density: string;
    layering: string;
    transitions: string;
    buildAndRelease: string;
  };
  mood: string[];
  genre: { primary: string; secondary: string[]; influences: string[] };
  strengths: string[];
  weaknesses: string[];
  estimatedDuration: number;
}

const AUDIO_ANALYSIS_PROMPT = `You are an expert music analyst and audio engineer. Listen carefully to this audio file and provide a comprehensive musical analysis. You must actually listen to the audio — do not guess or fabricate details.

Analyze the following aspects and return your analysis as a JSON object:

{
  "overview": "A 2-3 sentence summary of what you hear — genre, mood, quality, standout elements",
  "tempo": {
    "bpm": <estimated BPM as number>,
    "confidence": "high|medium|low",
    "feel": "description of the rhythmic feel (e.g., 'driving four-on-the-floor', 'laid-back shuffle')"
  },
  "key": {
    "estimated": "e.g., C major, F# minor",
    "confidence": "high|medium|low",
    "modality": "major|minor|modal|ambiguous"
  },
  "energy": {
    "overall": "low|medium-low|medium|medium-high|high",
    "curve": [
      {"timestamp": "0:00-0:30", "level": <1-10>, "description": "what's happening energy-wise"},
      // ... cover the full track in ~30s windows
    ],
    "dynamicRange": "compressed|moderate|wide|very wide"
  },
  "sections": [
    {
      "name": "Intro|Verse|Pre-Chorus|Chorus|Bridge|Outro|Instrumental|Breakdown|Build|Drop|Solo|Interlude",
      "startTime": "M:SS",
      "endTime": "M:SS",
      "description": "What's happening musically in this section",
      "energy": <1-10>,
      "musicalElements": ["list of notable elements in this section"]
    }
  ],
  "instrumentation": ["list every instrument/sound source you can identify"],
  "production": {
    "mixQuality": "Assessment of the overall mix quality and balance",
    "spatialCharacteristics": "stereo width, depth, panning choices",
    "frequencyBalance": "how well balanced are lows, mids, highs",
    "dynamicProcessing": "compression, limiting observations",
    "notableEffects": ["reverb", "delay", "distortion", etc.]
  },
  "melodicAnalysis": {
    "hookStrength": "weak|moderate|strong|very strong — explain why",
    "melodicContour": "describe the melodic movement patterns",
    "vocalCharacteristics": "if vocals present: tone, range, technique, emotion",
    "memorability": "how memorable is the main melody/hook"
  },
  "rhythmicAnalysis": {
    "groove": "description of the rhythmic feel and groove",
    "rhythmicDensity": "sparse|moderate|dense",
    "rhythmicVariation": "how much rhythmic variation across sections"
  },
  "arrangement": {
    "density": "sparse|moderate|full|dense — how many elements at once",
    "layering": "how well are elements layered and introduced",
    "transitions": "quality of transitions between sections",
    "buildAndRelease": "how well does the track build and release tension"
  },
  "mood": ["list 3-5 mood descriptors"],
  "genre": {
    "primary": "main genre",
    "secondary": ["sub-genres"],
    "influences": ["notable artist/genre influences you detect"]
  },
  "strengths": ["3-5 specific things that work well, with timestamps where possible"],
  "weaknesses": ["3-5 specific areas for improvement, with timestamps where possible"],
  "estimatedDuration": <duration in seconds>
}

Be specific and reference actual moments in the audio. Use timestamps. Do not be generic — this analysis should prove you actually listened to the track. Label uncertain inferences (e.g., "key estimate" or "approximate BPM").`;

export async function analyzeAudioWithGemini(audioUrl: string, mimeType: string, reviewFocus?: ReviewFocusRole): Promise<GeminiAudioAnalysis> {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Download the audio file to get its bytes
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  // Map common mime types
  const geminiMimeType = mimeType === "audio/mpeg" ? "audio/mpeg" :
    mimeType === "audio/wav" ? "audio/wav" :
    mimeType === "audio/mp4" || mimeType === "audio/m4a" ? "audio/mp4" :
    mimeType === "audio/ogg" ? "audio/ogg" :
    "audio/mpeg";

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: geminiMimeType,
              data: audioBase64,
            },
          },
          {
            text: buildAnalysisPrompt(reviewFocus),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  const url = `${GEMINI_API_BASE}/models/gemini-2.5-flash:generateContent?key=${ENV.geminiApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} — ${errorText}`);
  }

  const result = await response.json();

  // Extract the text content from Gemini's response
  const textContent = result.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.text
  )?.text;

  if (!textContent) {
    throw new Error("Gemini returned no text content in response");
  }

  // Parse the JSON response
  const cleaned = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const analysis: GeminiAudioAnalysis = JSON.parse(cleaned);

  return analysis;
}

function buildAnalysisPrompt(reviewFocus?: ReviewFocusRole): string {
  const focus = getFocusConfig(reviewFocus || "full");
  if (!focus.geminiAddendum) {
    return AUDIO_ANALYSIS_PROMPT;
  }
  return `${AUDIO_ANALYSIS_PROMPT}\n\n## ADDITIONAL FOCUS AREAS\n\nThe user is a ${focus.label}. ${focus.geminiAddendum}`;
}

/**
 * Analyze audio for comparison between two versions
 */
export async function compareAudioWithGemini(
  audioUrl1: string, mimeType1: string,
  audioUrl2: string, mimeType2: string
): Promise<string> {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const [audio1, audio2] = await Promise.all([
    fetch(audioUrl1).then(r => r.arrayBuffer()),
    fetch(audioUrl2).then(r => r.arrayBuffer()),
  ]);

  const mapMime = (m: string) => m === "audio/mpeg" ? "audio/mpeg" :
    m === "audio/wav" ? "audio/wav" :
    m === "audio/mp4" || m === "audio/m4a" ? "audio/mp4" : "audio/mpeg";

  const requestBody = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mapMime(mimeType1), data: Buffer.from(audio1).toString("base64") } },
          { text: "This is VERSION 1 of the track." },
          { inline_data: { mime_type: mapMime(mimeType2), data: Buffer.from(audio2).toString("base64") } },
          { text: "This is VERSION 2 of the track." },
          {
            text: `You are an expert music producer and audio engineer. Listen carefully to BOTH versions of this track and provide a detailed comparison analysis.

Focus on:
1. What changed between v1 and v2 (be specific with timestamps)
2. Production differences (mix, mastering, effects)
3. Arrangement changes (added/removed elements, structural changes)
4. Performance differences (vocal delivery, instrumental performance)
5. Energy and dynamics comparison
6. Which version is stronger and why

Provide your analysis as detailed text with clear section headers. Be honest and specific — reference actual moments you hear in each version.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  const url = `${GEMINI_API_BASE}/models/gemini-2.5-flash:generateContent?key=${ENV.geminiApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini comparison API error: ${response.status} — ${errorText}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
}
