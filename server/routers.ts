import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, aiAnalysisProcedure, aiChatProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import * as db from "./db";
import { storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { generateFollowUp, generateReferenceComparison } from "./services/claudeCritic";
import { compareReferenceWithGemini } from "./services/geminiAudio";
import { and } from "drizzle-orm";
import { trackRouter } from "./routers/trackRouter";
import { jobRouter } from "./routers/jobRouter";
import { reviewRouter } from "./routers/reviewRouter";
import { chatRouter } from "./routers/chatRouter";
import { analysisRouter } from "./routers/analysisRouter";
import { collaborationRouter } from "./routers/collaborationRouter";
import { playlistRouter } from "./routers/playlistRouter";
import { subscriptionRouter } from "./routers/subscriptionRouter";
import { creativeRouter } from "./routers/creativeRouter";
import { portfolioRouter } from "./routers/portfolioRouter";

// ── Guards (re-exported from guards.ts to avoid circular imports) ──
import { ALLOWED_AUDIO_TYPES, MAX_FILE_SIZE, assertUsageAllowed, assertFeatureAllowed, assertMonthlyReviewAllowed } from "./guards";
export { assertUsageAllowed, assertFeatureAllowed, assertMonthlyReviewAllowed, ALLOWED_AUDIO_TYPES, MAX_FILE_SIZE };

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  project: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const projects = await db.getProjectsByUser(ctx.user.id);
      if (projects.length === 0) return [];
      // Batch fetch all track counts in a single query (fixes N+1)
      const trackCounts = await db.getTrackCountsByProjects(projects.map(p => p.id));
      return projects.map(p => {
        const counts = trackCounts.get(p.id) || { total: 0, reviewed: 0, processing: 0 };
        let derivedStatus = p.status;
        if (counts.total === 0) derivedStatus = "draft";
        else if (counts.processing > 0) derivedStatus = "processing";
        else if (counts.reviewed === counts.total) derivedStatus = "reviewed";
        else if (counts.reviewed > 0) derivedStatus = "processing";
        return { ...p, status: derivedStatus, trackCount: counts.total, reviewedCount: counts.reviewed };
      });
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.id);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const tracks = await db.getTracksByProject(project.id);
        const reviews = await db.getReviewsByProject(project.id);
        const jobs = await db.getJobsByProject(project.id);
        return { project, tracks, reviews, jobs };
      }),

    create: protectedProcedure
      .input(z.object({
        type: z.enum(["single", "album"]).optional().default("single"),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        intentNotes: z.string().optional(),
        genre: z.string().optional(),
        referenceArtists: z.string().optional(),
        albumConcept: z.string().optional(),
        targetVibe: z.string().optional(),
        reviewFocus: z.enum(["songwriter", "producer", "arranger", "artist", "anr", "full"]).default("full"),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createProject({
          ...input,
          userId: ctx.user.id,
          description: input.description || null,
          intentNotes: input.intentNotes || null,
          genre: input.genre || null,
          referenceArtists: input.referenceArtists || null,
          albumConcept: input.albumConcept || null,
          targetVibe: input.targetVibe || null,
          reviewFocus: input.reviewFocus,
        });
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        intentNotes: z.string().optional(),
        genre: z.string().optional(),
        referenceArtists: z.string().optional(),
        albumConcept: z.string().optional(),
        targetVibe: z.string().optional(),
        reviewFocus: z.enum(["songwriter", "producer", "arranger", "artist", "anr", "full"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.id);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const { id, ...data } = input;
        await db.updateProject(id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.id);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        await db.deleteProject(input.id);
        return { success: true };
      }),

    uploadCoverImage: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        base64Image: z.string(),
        contentType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const base64Data = input.base64Image.includes(";base64,")
          ? input.base64Image.split(";base64,").pop()!
          : input.base64Image;
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Image must be under 5 MB" });
        }
        const ext = input.contentType.split("/")[1] || "jpg";
        const key = `project-covers/${project.id}/${nanoid()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        await db.updateProjectCoverImage(project.id, url);
        return { success: true, coverImageUrl: url };
      }),
  }),

  track: trackRouter,

  tags: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        return db.getTrackTags(input.trackId);
      }),

    update: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        tags: z.array(z.string().min(1).max(50)).max(20),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        await db.updateTrackTags(input.trackId, input.tags);
        return { success: true };
      }),

    removeTag: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        tag: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const existing = await db.getTrackTags(input.trackId);
        const updated = existing.filter(t => t !== input.tag);
        await db.updateTrackTags(input.trackId, updated);
         return { success: true, tags: updated };
      }),

    // Batch tag management
    listAll: protectedProcedure.query(async ({ ctx }) => {
      const allTracks = await db.getTracksByUser(ctx.user.id);
      const tagMap = new Map<string, { count: number; trackIds: number[]; projectIds: Set<number> }>();
      for (const track of allTracks) {
        const tags = track.tags ? track.tags.split(",").filter(Boolean).map((t: string) => t.trim()) : [];
        for (const tag of tags) {
          const entry = tagMap.get(tag) || { count: 0, trackIds: [], projectIds: new Set() };
          entry.count++;
          entry.trackIds.push(track.id);
          entry.projectIds.add(track.projectId);
          tagMap.set(tag, entry);
        }
      }
      return Array.from(tagMap.entries()).map(([name, info]) => ({
        name,
        count: info.count,
        trackIds: info.trackIds,
        projectIds: Array.from(info.projectIds),
      })).sort((a, b) => b.count - a.count);
    }),

    rename: protectedProcedure
      .input(z.object({ oldName: z.string().min(1), newName: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        const allTracks = await db.getTracksByUser(ctx.user.id);
        let updated = 0;
        for (const track of allTracks) {
          const tags = track.tags ? track.tags.split(",").filter(Boolean).map((t: string) => t.trim()) : [];
          if (tags.includes(input.oldName)) {
            const newTags = tags.map(t => t === input.oldName ? input.newName : t);
            // Deduplicate
            const unique = Array.from(new Set(newTags));
            await db.updateTrackTags(track.id, unique);
            updated++;
          }
        }
        return { success: true, tracksUpdated: updated };
      }),

    merge: protectedProcedure
      .input(z.object({ sourceTags: z.array(z.string().min(1)).min(1), targetTag: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        const allTracks = await db.getTracksByUser(ctx.user.id);
        let updated = 0;
        for (const track of allTracks) {
          const tags = track.tags ? track.tags.split(",").filter(Boolean).map((t: string) => t.trim()) : [];
          const hasSource = tags.some(t => input.sourceTags.includes(t));
          if (hasSource) {
            const filtered = tags.filter(t => !input.sourceTags.includes(t));
            if (!filtered.includes(input.targetTag)) filtered.push(input.targetTag);
            await db.updateTrackTags(track.id, filtered);
            updated++;
          }
        }
        return { success: true, tracksUpdated: updated };
      }),

    deleteTag: protectedProcedure
      .input(z.object({ tagName: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const allTracks = await db.getTracksByUser(ctx.user.id);
        let updated = 0;
        for (const track of allTracks) {
          const tags = track.tags ? track.tags.split(",").filter(Boolean).map((t: string) => t.trim()) : [];
          if (tags.includes(input.tagName)) {
            const filtered = tags.filter(t => t !== input.tagName);
            await db.updateTrackTags(track.id, filtered);
            updated++;
          }
        }
        return { success: true, tracksUpdated: updated };
      }),
  }),
  lyrics: router({
    save: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        text: z.string().min(1),
        source: z.enum(["user", "transcribed"]).default("user"),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        return db.upsertLyrics(input.trackId, input.text, input.source);
      }),

    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        return db.getLyricsByTrack(input.trackId);
      }),

    transcribe: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const result = await transcribeAudio({ audioUrl: track.storageUrl, language: "en" });
        if ("error" in result) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
        }
        await db.upsertLyrics(input.trackId, result.text, "transcribed");
        return { text: result.text, language: result.language };
      }),
  }),

  job: jobRouter,

  review: reviewRouter,

  favorite: router({
    toggle: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const isFavorited = await db.toggleFavorite(ctx.user.id, input.trackId);
        return { isFavorited };
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getFavoritesByUser(ctx.user.id);
      }),

    ids: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getFavoriteTrackIds(ctx.user.id);
      }),
  }),

  conversation: router({
    list: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.reviewId);
        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "chat");
        return db.getConversationByReview(input.reviewId);
      }),

    send: aiChatProcedure
      .input(z.object({
        reviewId: z.number(),
        message: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.reviewId);
        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "chat");
        // Save user message
        await db.createConversationMessage({
          reviewId: input.reviewId,
          userId: ctx.user.id,
          role: "user",
          content: input.message,
        });

        // Get conversation history
        const history = await db.getConversationByReview(input.reviewId);
        const conversationHistory = history.slice(0, -1).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        // Get track and audio features for context
        const track = review.trackId ? await db.getTrackById(review.trackId) : null;
        const features = review.trackId ? await db.getAudioFeaturesByTrack(review.trackId) : null;

        // Build review context for the follow-up
        const reviewContext = `Track: ${track?.originalFilename || "Unknown Track"}

Review:
${review.reviewMarkdown || ""}

Audio Analysis:
${JSON.stringify(features?.geminiAnalysisJson || {}, null, 2)}`;

        // Generate follow-up response
        const response = await generateFollowUp(
          reviewContext,
          conversationHistory,
          input.message,
        );

        // Save assistant response
        await db.createConversationMessage({
          reviewId: input.reviewId,
          userId: ctx.user.id,
          role: "assistant",
          content: response,
        });

        return { response };
      }),
  }),

  reference: router({
    upload: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        fileBase64: z.string(),
        fileSize: z.number(),
        artistName: z.string().optional(),
        trackTitle: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "reference");
        const fileBuffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `reference/${ctx.user.id}/${input.trackId}/${nanoid()}-${input.filename}`;
        const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

        const ref = await db.createReferenceTrack({
          trackId: input.trackId,
          userId: ctx.user.id,
          filename: input.filename,
          originalFilename: input.filename,
          storageUrl: url,
          storageKey: fileKey,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
        });
        return { id: ref.id, storageUrl: url };
      }),

    list: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        return db.getReferenceTracksByTrack(input.trackId);
      }),

    compare: aiAnalysisProcedure
      .input(z.object({ referenceId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ref = await db.getReferenceTrackById(input.referenceId);
        if (!ref || ref.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Reference track not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "reference");
        const track = await db.getTrackById(ref.trackId);
        if (!track) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const features = await db.getAudioFeaturesByTrack(track.id);

        // Use Gemini to listen to both tracks side-by-side
        const geminiResult = await compareReferenceWithGemini(
          track.storageUrl, track.mimeType,
          ref.storageUrl, ref.mimeType
        );

        // Use Claude to write the comparison critique
        const comparisonMarkdown = await generateReferenceComparison(
          track.originalFilename,
          (features?.geminiAnalysisJson || {}) as any,
          geminiResult.referenceAnalysis as any,
          geminiResult.comparison,
        );

        await db.updateReferenceTrackComparison(ref.id, comparisonMarkdown);
        return { comparisonResult: comparisonMarkdown };
      }),

    importUrl: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        url: z.string().url(),
        title: z.string().max(255).optional(),
        artist: z.string().max(255).optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "reference");

        // Detect platform from URL
        let platform = "unknown";
        let displayName = input.title || "Reference Track";
        const urlLower = input.url.toLowerCase();
        if (urlLower.includes("spotify.com") || urlLower.includes("open.spotify")) {
          platform = "spotify";
          displayName = input.title || "Spotify Reference";
        } else if (urlLower.includes("soundcloud.com")) {
          platform = "soundcloud";
          displayName = input.title || "SoundCloud Reference";
        } else if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
          platform = "youtube";
          displayName = input.title || "YouTube Reference";
        } else if (urlLower.includes("apple.com/music") || urlLower.includes("music.apple.com")) {
          platform = "apple_music";
          displayName = input.title || "Apple Music Reference";
        } else if (urlLower.includes("tidal.com")) {
          platform = "tidal";
          displayName = input.title || "Tidal Reference";
        }

        const filename = `${displayName}${input.artist ? ` - ${input.artist}` : ''}`;

        // Store as a reference track with the URL as the storage URL
        // Audio comparison won't be available for URL-only references
        const ref = await db.createReferenceTrack({
          trackId: input.trackId,
          userId: ctx.user.id,
          filename: filename,
          originalFilename: filename,
          storageUrl: input.url,
          storageKey: `url-ref/${platform}/${nanoid()}`,
          mimeType: "application/x-url",
          fileSize: 0,
        });
        return { id: ref.id, platform, displayName: filename };
      }),

    delete: protectedProcedure
      .input(z.object({ referenceId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ref = await db.getReferenceTrackById(input.referenceId);
        if (!ref || ref.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Reference track not found" });
        }
        await db.deleteReferenceTrack(input.referenceId);
        return { success: true };
      }),
  }),

  scoreHistory: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const parentId = track.parentTrackId || track.id;
        return db.getScoreHistoryForTrack(parentId);
      }),
  }),

  chat: chatRouter,

  analytics: router({
    recentFeed: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(30).optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.getRecentActivity(ctx.user.id, input?.limit ?? 10);
      }),
    quickStats: protectedProcedure.query(async ({ ctx }) => {
      // Lightweight stats available to all tiers (no analytics gate)
      const stats = await db.getDashboardStats(ctx.user.id);
      // Get average overall score
      const averageScores = await db.getAverageScores(ctx.user.id);
      const avgOverall = averageScores?.overall ?? averageScores?.Overall ?? null;
      // Get most recent review date
      const recentActivity = await db.getRecentActivity(ctx.user.id, 1);
      const lastReviewDate = recentActivity.length > 0 ? recentActivity[0].createdAt : null;
      // Get top genre from tracks
      const topGenre = await db.getTopGenre(ctx.user.id);
      return {
        ...stats,
        averageScore: avgOverall !== null ? Math.round(avgOverall * 10) / 10 : null,
        lastReviewDate,
        topGenre,
      };
    }),
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      assertFeatureAllowed(user?.tier || "free", "analytics");
      const [stats, scoreDistribution, recentActivity, averageScores, topTracks] = await Promise.all([
        db.getDashboardStats(ctx.user.id),
        db.getScoreDistribution(ctx.user.id),
        db.getRecentActivity(ctx.user.id),
        db.getAverageScores(ctx.user.id),
        db.getTopTracks(ctx.user.id),
      ]);
      return { stats, scoreDistribution, recentActivity, averageScores, topTracks };
    }),
    trends: protectedProcedure
      .input(z.object({ weeks: z.number().min(4).max(52).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "analytics");
        return db.getWeeklyScoreTrends(ctx.user.id, input?.weeks ?? 12);
      }),
    heatmap: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      assertFeatureAllowed(user?.tier || "free", "analytics");
      return db.getActivityHeatmap(ctx.user.id);
    }),
    improvement: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      assertFeatureAllowed(user?.tier || "free", "analytics");
      return db.getImprovementRate(ctx.user.id);
    }),
  }),

  sentiment: router({
    timeline: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        if (project.userId !== ctx.user.id) {
          // Check if collaborator
          const isCollab = await db.isUserCollaborator(ctx.user.id, input.projectId);
          if (!isCollab) throw new TRPCError({ code: "FORBIDDEN" });
        }
        const rawTimeline = await db.getProjectSentimentTimeline(input.projectId);
        // Compute sentiment from scores and review text
        return rawTimeline.map(r => {
          const scores = r.scoresJson as Record<string, number> | null;
          const overall = scores?.overall ?? scores?.Overall ?? 0;
          // Derive sentiment from score + text analysis
          let sentiment: "positive" | "mixed" | "critical" = "mixed";
          const positiveWords = ["excellent", "outstanding", "strong", "impressive", "great", "brilliant", "solid", "polished", "well-crafted", "compelling"];
          const negativeWords = ["weak", "lacking", "muddy", "cluttered", "repetitive", "flat", "thin", "underdeveloped", "generic", "needs work"];
          const text = (r.quickTake || "").toLowerCase() + " " + (r.reviewMarkdown || "").toLowerCase().slice(0, 500);
          const posCount = positiveWords.filter(w => text.includes(w)).length;
          const negCount = negativeWords.filter(w => text.includes(w)).length;
          if (overall >= 7.5 || posCount > negCount + 1) sentiment = "positive";
          else if (overall <= 4.5 || negCount > posCount + 1) sentiment = "critical";
          // Extract key phrases
          const keyPhrases: string[] = [];
          for (const w of positiveWords) { if (text.includes(w)) keyPhrases.push(w); }
          for (const w of negativeWords) { if (text.includes(w)) keyPhrases.push(w); }
          return {
            reviewId: r.id,
            trackId: r.trackId,
            trackName: r.trackName,
            quickTake: r.quickTake,
            overall,
            sentiment,
            keyPhrases: keyPhrases.slice(0, 5),
            createdAt: r.createdAt,
            reviewVersion: r.reviewVersion,
          };
        });
      }),
  }),

  // ── Review Templates ──
  template: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getReviewTemplatesByUser(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        focusAreas: z.array(z.string()).min(1),
        systemPrompt: z.string().max(5000).optional(),
        icon: z.string().max(50).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.isDefault) {
          await db.setDefaultTemplate(ctx.user.id, -1); // unset all defaults
        }
        const result = await db.createReviewTemplate({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          focusAreas: input.focusAreas,
          systemPrompt: input.systemPrompt || null,
          icon: input.icon || null,
          isDefault: input.isDefault || false,
        });
        if (input.isDefault) {
          await db.setDefaultTemplate(ctx.user.id, result.id);
        }
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        focusAreas: z.array(z.string()).min(1).optional(),
        systemPrompt: z.string().max(5000).optional().nullable(),
        icon: z.string().max(50).optional().nullable(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const template = await db.getReviewTemplateById(input.id);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }
        const { id, isDefault, ...data } = input;
        await db.updateReviewTemplate(id, data as any);
        if (isDefault !== undefined) {
          if (isDefault) {
            await db.setDefaultTemplate(ctx.user.id, id);
          } else {
            await db.updateReviewTemplate(id, { isDefault: false });
          }
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const template = await db.getReviewTemplateById(input.id);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }
        await db.deleteReviewTemplate(input.id);
        return { success: true };
      }),
  }),

  // ── Waveform Annotations (Feature 4) ──
  annotation: router({
    list: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        return db.getAnnotationsByTrack(input.trackId);
      }),

    create: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        timestampMs: z.number().min(0),
        content: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createAnnotation({
          trackId: input.trackId,
          userId: ctx.user.id,
          timestampMs: input.timestampMs,
          content: input.content,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().min(1).max(2000).optional(),
        resolved: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateAnnotation(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteAnnotation(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ── Notifications ──
  notification: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const items = await db.getNotifications(ctx.user.id, input?.limit || 50);
        const unreadCount = await db.getUnreadNotificationCount(ctx.user.id);
        return { items, unreadCount };
      }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadNotificationCount(ctx.user.id) };
    }),

    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),

    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      return db.getNotificationPreferences(ctx.user.id);
    }),

    updatePreferences: protectedProcedure
      .input(z.object({
        review_complete: z.boolean().optional(),
        collaboration_invite: z.boolean().optional(),
        collaboration_accepted: z.boolean().optional(),
        digest: z.boolean().optional(),
        payment_failed: z.boolean().optional(),
        system: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.updateNotificationPreferences(ctx.user.id, input);
      }),
  }),

  // ── Review Quality ──
  reviewQuality: router({
    get: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ input }) => {
        const quality = await db.getReviewQualityMetadata(input.reviewId);
        if (!quality) throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        return quality;
      }),
    trackReviews: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        return db.getTrackReviewsWithQuality(input.trackId);
      }),
  }),

  // ── Global Search ──
  search: router({
    global: protectedProcedure
      .input(z.object({
        query: z.string().min(1).max(200),
        filter: z.enum(["all", "projects", "tracks", "reviews"]).default("all"),
        limit: z.number().min(1).max(50).default(20),
      }))
      .query(async ({ ctx, input }) => {
        return db.globalSearch(ctx.user.id, input.query, input.filter, input.limit);
      }),
   }),
  // ── Review Digest ──
  ...analysisRouter,
  ...collaborationRouter,
  ...playlistRouter,
  ...subscriptionRouter,
  ...creativeRouter,
  ...portfolioRouter,

  digest: router({
    get: protectedProcedure
      .input(z.object({
        daysBack: z.number().min(1).max(90).default(7),
      }))
      .query(async ({ ctx, input }) => {
        return db.getDigestData(ctx.user.id, input.daysBack);
      }),

    generateEmail: aiAnalysisProcedure
      .input(z.object({
        daysBack: z.number().min(1).max(90).default(7),
      }))
      .mutation(async ({ ctx, input }) => {
        const data = await db.getDigestData(ctx.user.id, input.daysBack);
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });

        const periodLabel = input.daysBack === 7 ? "This Week" : input.daysBack === 14 ? "Last 2 Weeks" : `Last ${input.daysBack} Days`;

        // Build the email-style digest HTML
        let trackRows = '';
        if (data.reviews && data.reviews.length > 0) {
          trackRows = data.reviews.map((r) => {
            const scores = (typeof r.scoresJson === 'string' ? JSON.parse(r.scoresJson) : r.scoresJson) as Record<string, number> | null;
            const score = scores?.overall ?? scores?.overallScore;
            const scoreDisplay = typeof score === 'number' ? score : '—';
            const scoreColor = typeof score === 'number' ? (score >= 8 ? '#22c55e' : score >= 6 ? '#3b82f6' : score >= 4 ? '#f59e0b' : '#ef4444') : '#888';
            return `<tr><td style="padding:12px 16px;border-bottom:1px solid #1e1e35;">${r.trackFilename || 'Unknown'}</td><td style="padding:12px 16px;border-bottom:1px solid #1e1e35;color:${scoreColor};font-weight:700;text-align:center;">${scoreDisplay}/10</td><td style="padding:12px 16px;border-bottom:1px solid #1e1e35;color:#888;font-size:0.85em;">${r.quickTake || '—'}</td></tr>`;
          }).join('');
        }

        const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Troubadour Weekly Digest</title></head><body style="margin:0;padding:0;background:#0a0a14;color:#e8e8f0;font-family:'Inter',system-ui,-apple-system,sans-serif;">
          <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
            <div style="text-align:center;padding:24px 0;border-bottom:2px solid #1e1e35;margin-bottom:24px;">
              <h1 style="font-size:1.5em;font-weight:800;margin:0 0 4px;">Troubadour</h1>
              <p style="color:#888;margin:0;font-size:0.9em;">Your ${periodLabel} Digest</p>
            </div>
            <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:24px;">
              <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.totalReviews}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Reviews</div></div>
              <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.totalNewProjects}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Projects</div></div>
              <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.averageScore ?? '—'}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Avg Score</div></div>
            </div>
            ${trackRows ? `<h2 style="font-size:1.1em;font-weight:600;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid #1e1e35;">Recent Reviews</h2><table style="width:100%;border-collapse:collapse;"><thead><tr style="color:#888;font-size:0.8em;text-transform:uppercase;"><th style="text-align:left;padding:8px 16px;">Track</th><th style="text-align:center;padding:8px 16px;">Score</th><th style="text-align:left;padding:8px 16px;">Quick Take</th></tr></thead><tbody>${trackRows}</tbody></table>` : '<p style="text-align:center;color:#888;padding:24px;">No reviews this period. Upload some tracks to get started!</p>'}
            ${data.stats.highestScore ? `<div style="margin:24px 0;padding:16px;background:#12121f;border:1px solid #1e1e35;border-radius:12px;"><h3 style="margin:0 0 8px;font-size:0.9em;color:#888;">Top Track</h3><p style="margin:0;font-weight:600;">${data.stats.highestScore.track} — <span style="color:#22c55e;">${data.stats.highestScore.score}/10</span></p></div>` : ''}
            <div style="text-align:center;padding:24px 0;border-top:1px solid #1e1e35;margin-top:24px;color:#888;font-size:0.75em;">Generated by Troubadour AI &middot; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </body></html>`;

        // Also create an in-app notification
        await db.createNotification({
          userId: ctx.user.id,
          type: "digest",
          title: `${periodLabel} Digest Ready`,
          message: `Your ${periodLabel.toLowerCase()} digest is ready with ${data.stats.totalReviews} reviews and an average score of ${data.stats.averageScore ?? '—'}/10.`,
          link: "/digest",
        });

        // Send email via Postmark (if configured)
        let emailSent = false;
        if (user.email) {
          try {
            const { sendDigestEmail } = await import("./services/emailService");
            const result = await sendDigestEmail({
              to: user.email,
              userName: user.name || "Artist",
              htmlContent,
              periodLabel,
            });
            emailSent = result.success;
          } catch (e) {
            console.warn("[Digest] Email delivery failed:", e);
          }
        }

        // Record when digest was sent
        if (emailSent) {
          await db.updateLastDigestSentAt(ctx.user.id);
        }

        // Notify owner via platform notification
        try {
          const { notifyOwner } = await import("./_core/notification");
          await notifyOwner({
            title: `Troubadour ${periodLabel} Digest`,
            content: `${user.name}'s digest: ${data.stats.totalReviews} reviews, avg ${data.stats.averageScore ?? '—'}/10. Top track: ${data.stats.highestScore?.track ?? 'N/A'} (${data.stats.highestScore?.score ?? '—'}/10).`,
          });
        } catch (e) {
          console.warn("[Digest] Owner notification failed:", e);
        }

        return { htmlContent, stats: data.stats, emailSent };
      }),

    getPreferences: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        return {
          frequency: user?.digestFrequency ?? "weekly",
          lastDigestSentAt: user?.lastDigestSentAt?.getTime() ?? null,
        };
      }),

    updatePreferences: protectedProcedure
      .input(z.object({ frequency: z.enum(["weekly", "biweekly", "monthly", "disabled"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserDigestFrequency(ctx.user.id, input.frequency);
        return { success: true, frequency: input.frequency };
      }),

    sendTest: protectedProcedure
      .mutation(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (!user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "No email address on file. Please update your profile first." });

        // Generate a small digest
        const data = await db.getDigestData(ctx.user.id, 7);
        const periodLabel = "Test Digest";

        let trackRows = '';
        if (data.reviews && data.reviews.length > 0) {
          trackRows = data.reviews.slice(0, 5).map((r) => {
            const scores = (typeof r.scoresJson === 'string' ? JSON.parse(r.scoresJson) : r.scoresJson) as Record<string, number> | null;
            const score = scores?.overall ?? scores?.overallScore;
            const scoreDisplay = typeof score === 'number' ? score : '\u2014';
            const scoreColor = typeof score === 'number' ? (score >= 8 ? '#22c55e' : score >= 6 ? '#3b82f6' : score >= 4 ? '#f59e0b' : '#ef4444') : '#888';
            return `<tr><td style="padding:12px 16px;border-bottom:1px solid #1e1e35;">${r.trackFilename || 'Unknown'}</td><td style="padding:12px 16px;border-bottom:1px solid #1e1e35;color:${scoreColor};font-weight:700;text-align:center;">${scoreDisplay}/10</td><td style="padding:12px 16px;border-bottom:1px solid #1e1e35;color:#888;font-size:0.85em;">${r.quickTake || '\u2014'}</td></tr>`;
          }).join('');
        }

        const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Troubadour Test Digest</title></head><body style="margin:0;padding:0;background:#0a0a14;color:#e8e8f0;font-family:'Inter',system-ui,-apple-system,sans-serif;">
          <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
            <div style="text-align:center;padding:24px 0;border-bottom:2px solid #1e1e35;margin-bottom:24px;">
              <h1 style="font-size:1.5em;font-weight:800;margin:0 0 4px;">Troubadour</h1>
              <p style="color:#888;margin:0;font-size:0.9em;">Test Digest Email</p>
              <p style="color:#f59e0b;margin:8px 0 0;font-size:0.8em;">This is a test email to verify your digest delivery works correctly.</p>
            </div>
            <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:24px;">
              <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.totalReviews}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Reviews</div></div>
              <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.totalNewProjects}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Projects</div></div>
              <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.averageScore ?? '\u2014'}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Avg Score</div></div>
            </div>
            ${trackRows ? `<h2 style="font-size:1.1em;font-weight:600;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid #1e1e35;">Recent Reviews</h2><table style="width:100%;border-collapse:collapse;"><thead><tr style="color:#888;font-size:0.8em;text-transform:uppercase;"><th style="text-align:left;padding:8px 16px;">Track</th><th style="text-align:center;padding:8px 16px;">Score</th><th style="text-align:left;padding:8px 16px;">Quick Take</th></tr></thead><tbody>${trackRows}</tbody></table>` : '<p style="text-align:center;color:#888;padding:24px;">No reviews this week. Upload some tracks to get started!</p>'}
            <div style="text-align:center;padding:24px 0;border-top:1px solid #1e1e35;margin-top:24px;color:#888;font-size:0.75em;">Test digest generated by Troubadour AI</div>
          </div>
        </body></html>`;

        // Send via Postmark
        let emailSent = false;
        try {
          const { sendDigestEmail } = await import("./services/emailService");
          const result = await sendDigestEmail({
            to: user.email,
            userName: user.name || "Artist",
            htmlContent,
            periodLabel,
          });
          emailSent = result.success;
        } catch (e: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Email delivery failed: ${e.message || 'Unknown error'}. Check that Postmark is configured in Settings.` });
        }

        if (emailSent) {
          await db.updateLastDigestSentAt(ctx.user.id);
        }

        return { success: emailSent, email: user.email };
      }),
  }),

});
export type AppRouter = typeof appRouter;
