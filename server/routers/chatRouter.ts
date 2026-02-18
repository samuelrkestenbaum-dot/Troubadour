import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, aiChatProcedure } from "../_core/trpc";
import * as db from "../db";
import { assertFeatureAllowed } from "../guards";

export const chatRouter = router({
  createSession: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      trackId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      assertFeatureAllowed(user?.tier || "free", "chat");
      // Build a title based on context
      let title = "New conversation";
      if (input.trackId) {
        const track = await db.getTrackById(input.trackId);
        if (track) title = `Chat about ${track.originalFilename}`;
      } else if (input.projectId) {
        const project = await db.getProjectById(input.projectId);
        if (project) title = `Chat about ${project.title}`;
      }
      const session = await db.createChatSession({
        userId: ctx.user.id,
        projectId: input.projectId ?? null,
        trackId: input.trackId ?? null,
        title,
      });

      // Build system context message
      const contextParts: string[] = ["You are Troubadour's music advisor — a world-class music critic, producer, and A&R executive. You have access to the user's project data and audio analysis. Be specific, honest, and actionable. Reference actual data when available."];

      if (input.projectId) {
        const project = await db.getProjectById(input.projectId);
        if (project) {
          contextParts.push(`\nProject: "${project.title}" (${project.type}, ${project.genre || "no genre specified"})`);
          if (project.intentNotes) contextParts.push(`Artist intent: ${project.intentNotes}`);
          if (project.referenceArtists) contextParts.push(`Reference artists: ${project.referenceArtists}`);
          const tracks = await db.getTracksByProject(project.id);
          if (tracks.length > 0) {
            contextParts.push(`\nTracks (${tracks.length}):`);
            for (const t of tracks) {
              contextParts.push(`- ${t.originalFilename} (${t.status})`);
              const features = await db.getAudioFeaturesByTrack(t.id);
              if (features?.geminiAnalysisJson) {
                const analysis = features.geminiAnalysisJson as any;
                contextParts.push(`  Audio: ${analysis.genre?.primary || "?"}, ${analysis.tempo?.bpm || "?"} BPM, key ${analysis.key?.estimated || "?"}, energy ${analysis.energy?.overall || "?"}/10`);
              }
            }
          }
          const reviews = await db.getReviewsByProject(project.id);
          if (reviews.length > 0) {
            contextParts.push(`\nReviews available: ${reviews.length}`);
            for (const r of reviews.slice(0, 5)) {
              const scores = r.scoresJson as Record<string, number> | null;
              contextParts.push(`- ${r.reviewType} review${r.trackId ? ` (track ${r.trackId})` : ""}: overall ${scores?.overall || "N/A"}/10`);
            }
          }
        }
      }

      if (input.trackId) {
        const track = await db.getTrackById(input.trackId);
        if (track) {
          const features = await db.getAudioFeaturesByTrack(track.id);
          if (features?.geminiAnalysisJson) {
            contextParts.push(`\nDetailed audio analysis for "${track.originalFilename}":\n${JSON.stringify(features.geminiAnalysisJson, null, 2)}`);
          }
          const trackReviews = await db.getReviewsByTrack(track.id);
          if (trackReviews.length > 0) {
            const latest = trackReviews[0];
            contextParts.push(`\nLatest review:\n${latest.reviewMarkdown?.substring(0, 3000) || "No review text"}`);
          }
          const trackLyrics = await db.getLyricsByTrack(track.id);
          if (trackLyrics.length > 0) {
            contextParts.push(`\nLyrics:\n${trackLyrics[0].text.substring(0, 2000)}`);
          }
        }
      }

      // Store system context as first message
      await db.createChatMessage({
        sessionId: session.id,
        role: "system",
        content: contextParts.join("\n"),
      });

      return { id: session.id, title };
    }),

  listSessions: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      trackId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getChatSessionsByUser(ctx.user.id, input.projectId, input.trackId);
    }),

  getMessages: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await db.getChatSessionById(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      return db.getChatMessagesBySession(input.sessionId);
    }),

  sendMessage: aiChatProcedure
    .input(z.object({
      sessionId: z.number(),
      message: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await db.getChatSessionById(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      const user = await db.getUserById(ctx.user.id);
      assertFeatureAllowed(user?.tier || "free", "chat");

      // Save user message
      await db.createChatMessage({
        sessionId: input.sessionId,
        role: "user",
        content: input.message,
      });

      // Get all messages for context
      const allMessages = await db.getChatMessagesBySession(input.sessionId);
      const systemMsg = allMessages.find(m => m.role === "system");
      const conversationMessages = allMessages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Call Claude 4.5
      const { callClaude } = await import("../services/claudeCritic");
      const systemPrompt = systemMsg?.content || "You are Troubadour's music advisor. Be specific, honest, and actionable.";
      const response = await callClaude(systemPrompt, conversationMessages, 4096);

      // Save assistant response
      await db.createChatMessage({
        sessionId: input.sessionId,
        role: "assistant",
        content: response,
      });

      // Update session title if this is the first real exchange
      if (conversationMessages.length <= 2) {
        const shortTitle = input.message.length > 50 ? input.message.substring(0, 47) + "..." : input.message;
        await db.updateChatSessionTitle(input.sessionId, shortTitle);
      } else {
        await db.touchChatSession(input.sessionId);
      }

      return { response };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await db.getChatSessionById(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      await db.deleteChatSession(input.sessionId);
      return { success: true };
    }),
});
