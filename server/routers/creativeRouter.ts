import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, aiAnalysisProcedure, imageGenProcedure } from "../_core/trpc";
import * as db from "../db";
import { assertFeatureAllowed } from "../guards";
import { invokeLLM } from "../_core/llm";

export const creativeRouter = {
  // ── Sentiment Heatmap ──
  sentimentHeatmap: router({
    generate: aiAnalysisProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        const trackReviews = await db.getReviewsByTrack(input.trackId);
        if (trackReviews.length === 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No reviews found for this track" });

        // Gather all review text
        const reviewTexts = trackReviews.map((r, i) => `--- Review Version ${i + 1} ---\n${r.reviewMarkdown}`).join("\n\n");

        // Use LLM to extract sentiment per section
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a music review analyst. Given one or more reviews of a track, extract sentiment data for each musical section (intro, verse, pre-chorus, chorus, bridge, outro, etc.). For each section, provide a sentiment score from -1.0 (very negative) to +1.0 (very positive), a brief summary of feedback, and key keywords. Also note which aspects are mentioned most positively and negatively across all reviews.`
            },
            {
              role: "user",
              content: `Analyze the sentiment across these reviews for the track "${track.originalFilename}":\n\n${reviewTexts}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "sentiment_heatmap",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Section name (e.g., Intro, Verse 1, Chorus)" },
                        sentiment: { type: "number", description: "Sentiment score from -1.0 to 1.0" },
                        summary: { type: "string", description: "Brief summary of feedback for this section" },
                        keywords: { type: "array", items: { type: "string" }, description: "Key feedback keywords" },
                        mentionCount: { type: "integer", description: "How many reviews mention this section" }
                      },
                      required: ["name", "sentiment", "summary", "keywords", "mentionCount"],
                      additionalProperties: false
                    }
                  },
                  strongestPositive: {
                    type: "object",
                    properties: {
                      section: { type: "string" },
                      aspect: { type: "string" }
                    },
                    required: ["section", "aspect"],
                    additionalProperties: false
                  },
                  strongestNegative: {
                    type: "object",
                    properties: {
                      section: { type: "string" },
                      aspect: { type: "string" }
                    },
                    required: ["section", "aspect"],
                    additionalProperties: false
                  },
                  overallTrend: { type: "string", description: "Brief description of sentiment trend across sections" }
                },
                required: ["sections", "strongestPositive", "strongestNegative", "overallTrend"],
                additionalProperties: false
              }
            }
          }
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate sentiment analysis" });
        return JSON.parse(content as string);
      }),
  }),

  // ── Artwork Concepts ──
  artwork: router({
    generate: imageGenProcedure
      .input(z.object({ projectId: z.number(), style: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "artwork");
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        const projectTracks = await db.getTracksByProject(input.projectId);
        const trackSummaries = projectTracks.map(t => {
          const genre = t.detectedGenre || "unknown";
          const tags = t.tags ? JSON.parse(t.tags as string) : [];
          return `"${t.originalFilename}" (${genre}, tags: ${tags.join(", ") || "none"})`;
        }).join("; ");

        // Use Claude to generate an image prompt + metadata
        const promptResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are an album artwork creative director. Given album metadata, generate a detailed image generation prompt and visual concept. Return JSON only." },
            { role: "user", content: `Album: "${project.title}"\nGenre: ${project.genre || "not specified"}\nConcept: ${project.albumConcept || "not specified"}\nTarget Vibe: ${project.targetVibe || "not specified"}\nTracks: ${trackSummaries}\nRequested style: ${input.style || "album cover art, professional"}\n\nGenerate a detailed image prompt for album cover artwork. Return JSON with: prompt (detailed image generation prompt, 2-3 sentences), moodDescription (1 sentence mood summary), colorPalette (array of 5 hex colors), visualStyle (e.g., "minimalist photography", "abstract expressionism", "retro illustration").` }
          ],
          response_format: {
            type: "json_schema" as const,
            json_schema: {
              name: "artwork_concept",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "Detailed image generation prompt" },
                  moodDescription: { type: "string", description: "Mood summary" },
                  colorPalette: { type: "array", items: { type: "string" }, description: "5 hex colors" },
                  visualStyle: { type: "string", description: "Visual style name" }
                },
                required: ["prompt", "moodDescription", "colorPalette", "visualStyle"],
                additionalProperties: false
              }
            }
          }
        });

        const conceptData = JSON.parse(promptResponse.choices?.[0]?.message?.content as string);

        // Create DB record
        const record = await db.createArtworkConcept({
          projectId: input.projectId,
          userId: ctx.user.id,
          prompt: conceptData.prompt,
          moodDescription: conceptData.moodDescription,
          colorPalette: conceptData.colorPalette,
          visualStyle: conceptData.visualStyle,
          status: "generating",
        });

        // Generate image asynchronously
        try {
          const { generateImage } = await import("../_core/imageGeneration");
          const { url: imageUrl } = await generateImage({ prompt: conceptData.prompt });
          if (record) {
            await db.updateArtworkConcept(record.id, { imageUrl, status: "complete" });
          }
          return { id: record?.id, imageUrl, ...conceptData, status: "complete" };
        } catch (err) {
          if (record) await db.updateArtworkConcept(record.id, { status: "error" });
          return { id: record?.id, imageUrl: null, ...conceptData, status: "error" };
        }
      }),

    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getArtworkConceptsByProject(input.projectId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteArtworkConcept(input.id);
        return { success: true };
      }),
  }),

  // ── Mastering Readiness Checklist ──
  mastering: router({
    generateChecklist: aiAnalysisProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "mastering_checklist");
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

        // Get the latest review and mix report for this track
        const latestReviews = await db.getReviewsByTrack(input.trackId);
        const latestReview = latestReviews[0];
        const mixReport = await db.getMixReportByTrack(input.trackId);

        let context = `Track: "${track.originalFilename}"\nGenre: ${track.detectedGenre || "unknown"}\n`;
        if (latestReview?.scoresJson) {
          const scores = latestReview.scoresJson as Record<string, number>;
          context += `Review Scores: ${Object.entries(scores).map(([k,v]) => `${k}: ${v}/10`).join(", ")}\n`;
        }
        if (latestReview?.quickTake) {
          context += `Quick Take: ${latestReview.quickTake}\n`;
        }
        if (mixReport) {
          context += `Mix Report available with frequency, dynamics, stereo, and loudness analysis.\n`;
          if (mixReport.frequencyAnalysis) context += `Frequency: ${JSON.stringify(mixReport.frequencyAnalysis).slice(0, 500)}\n`;
          if (mixReport.dynamicsAnalysis) context += `Dynamics: ${JSON.stringify(mixReport.dynamicsAnalysis).slice(0, 500)}\n`;
          if (mixReport.loudnessData) context += `Loudness: ${JSON.stringify(mixReport.loudnessData).slice(0, 500)}\n`;
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a mastering engineer. Based on the track's review scores and mix report, generate a mastering readiness checklist. Each item should identify a specific issue and provide a concrete suggestion for fixing it before mastering. Return JSON only." },
            { role: "user", content: context }
          ],
          response_format: {
            type: "json_schema" as const,
            json_schema: {
              name: "mastering_checklist",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", description: "Category: EQ, Dynamics, Stereo, Loudness, Arrangement, or General" },
                        issue: { type: "string", description: "Specific issue identified" },
                        suggestion: { type: "string", description: "Concrete fix suggestion" },
                        priority: { type: "string", enum: ["high", "medium", "low"], description: "Priority level" }
                      },
                      required: ["category", "issue", "suggestion", "priority"],
                      additionalProperties: false
                    }
                  },
                  overallReadiness: { type: "integer", description: "Overall mastering readiness score 0-100" }
                },
                required: ["items", "overallReadiness"],
                additionalProperties: false
              }
            }
          }
        });

        const checklistData = JSON.parse(response.choices?.[0]?.message?.content as string);
        const itemsWithIds = checklistData.items.map((item: any, i: number) => ({
          ...item,
          id: `item_${i}_${Date.now()}`,
          completed: false
        }));

        const record = await db.createMasteringChecklist({
          trackId: input.trackId,
          userId: ctx.user.id,
          itemsJson: itemsWithIds,
          overallReadiness: checklistData.overallReadiness,
        });

        return { id: record?.id, items: itemsWithIds, overallReadiness: checklistData.overallReadiness };
      }),

    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getMasteringChecklistByTrack(input.trackId);
      }),

    toggleItem: protectedProcedure
      .input(z.object({ checklistId: z.number(), itemId: z.string(), completed: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const dbObj = await (async () => {
          const d = await db.getDb();
          if (!d) return null;
          const { masteringChecklists } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const rows = await d.select().from(masteringChecklists).where(eq(masteringChecklists.id, input.checklistId)).limit(1);
          return rows[0] || null;
        })();
        if (!dbObj || dbObj.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

        const items = (dbObj.itemsJson as any[]).map((item: any) =>
          item.id === input.itemId ? { ...item, completed: input.completed } : item
        );
        const completedCount = items.filter((i: any) => i.completed).length;
        const completionPct = Math.round((completedCount / items.length) * 100);

        await db.updateMasteringChecklist(input.checklistId, { itemsJson: items, overallReadiness: completionPct });
        return { items, overallReadiness: completionPct };
      }),
  }),
};
