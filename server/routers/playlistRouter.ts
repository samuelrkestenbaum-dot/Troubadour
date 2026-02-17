import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { invokeLLM } from "../_core/llm";

export const playlistRouter = {
  // ── Smart Playlist Ordering ──
  playlist: router({
    suggestOrder: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        strategy: z.enum(["energy_arc", "key_flow", "mood_journey", "balanced"]).default("balanced"),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const projectTracks = await db.getTracksByProject(input.projectId);
        if (projectTracks.length < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Need at least 2 tracks to suggest an order" });
        }

        // Gather audio features for each track
        const trackData: Array<{
          id: number;
          title: string;
          order: number;
          tempo?: number;
          key?: string;
          modality?: string;
          energy?: string;
          mood?: string[];
          genre?: string;
          sections?: Array<{ name: string; energy: number }>;
        }> = [];

        for (const track of projectTracks) {
          const features = await db.getAudioFeaturesByTrack(track.id);
          const gemini = features?.geminiAnalysisJson as any;
          trackData.push({
            id: track.id,
            title: track.originalFilename.replace(/\.[^.]+$/, ""),
            order: track.trackOrder,
            tempo: gemini?.tempo?.bpm,
            key: gemini?.key?.estimated,
            modality: gemini?.key?.modality,
            energy: gemini?.energy?.overall,
            mood: gemini?.mood,
            genre: gemini?.genre?.primary,
            sections: gemini?.sections?.map((s: any) => ({ name: s.name, energy: s.energy })),
          });
        }

        const strategyDescriptions: Record<string, string> = {
          energy_arc: "Create a classic album energy arc: open strong to hook the listener, build through the middle, hit a peak/climax around track 60-70%, then bring it down for an emotional cooldown before a memorable closer.",
          key_flow: "Prioritize harmonic flow between tracks. Place songs in related keys next to each other (circle of fifths neighbors, relative major/minor). Avoid jarring key changes between consecutive tracks.",
          mood_journey: "Create an emotional narrative journey. Group and sequence tracks to tell a story — start with an establishing mood, develop tension or contrast, and resolve with a satisfying emotional conclusion.",
          balanced: "Balance all factors — energy arc, key relationships, mood flow, and tempo transitions — to create the most cohesive and engaging listening experience from start to finish.",
        };

        const prompt = `You are an expert A&R executive and album sequencing specialist. Given the following tracks from the album "${project.title}", suggest the optimal track order.

## Sequencing Strategy
${strategyDescriptions[input.strategy]}

## Track Data
${trackData.map((t, i) => `${i + 1}. "${t.title}" — Tempo: ${t.tempo || "unknown"} BPM, Key: ${t.key || "unknown"} (${t.modality || "unknown"}), Energy: ${t.energy || "unknown"}, Mood: ${t.mood?.join(", ") || "unknown"}, Genre: ${t.genre || "unknown"}`).join("\n")}

## Instructions
Return a JSON object with this exact schema:
{
  "suggestedOrder": [
    {
      "trackId": <number>,
      "position": <1-based position>,
      "reasoning": "<1-2 sentence explanation of why this track belongs here>"
    }
  ],
  "overallRationale": "<2-3 sentence summary of the sequencing philosophy>",
  "energyArc": "<description of the energy flow from opener to closer>"
}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert album sequencing specialist. Return only valid JSON, no markdown fences." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "playlist_order",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestedOrder: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        trackId: { type: "number" },
                        position: { type: "number" },
                        reasoning: { type: "string" },
                      },
                      required: ["trackId", "position", "reasoning"],
                      additionalProperties: false,
                    },
                  },
                  overallRationale: { type: "string" },
                  energyArc: { type: "string" },
                },
                required: ["suggestedOrder", "overallRationale", "energyArc"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate playlist suggestion" });

        const parsed = JSON.parse(content as string);
        // Enrich with track titles
        const enriched = parsed.suggestedOrder.map((item: any) => {
          const track = trackData.find(t => t.id === item.trackId);
          return {
            ...item,
            title: track?.title || "Unknown",
            tempo: track?.tempo,
            key: track?.key,
            energy: track?.energy,
          };
        });

        return {
          suggestedOrder: enriched,
          overallRationale: parsed.overallRationale,
          energyArc: parsed.energyArc,
          strategy: input.strategy,
          trackCount: projectTracks.length,
        };
      }),

    applyOrder: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        orderedTrackIds: z.array(z.number()).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return db.reorderTracks(input.projectId, input.orderedTrackIds);
      }),
  }),

  // ── Track Reorder ──
  reorder: router({
    update: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        orderedTrackIds: z.array(z.number()).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return db.reorderTracks(input.projectId, input.orderedTrackIds);
      }),
  }),
};
