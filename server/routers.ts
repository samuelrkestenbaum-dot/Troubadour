import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import * as db from "./db";
import { storagePut } from "./storage";
import { enqueueJob } from "./services/jobProcessor";
import { transcribeAudio } from "./_core/voiceTranscription";
import { generateFollowUp, generateReferenceComparison } from "./services/claudeCritic";
import { compareReferenceWithGemini } from "./services/geminiAudio";

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
      const result = [];
      for (const p of projects) {
        const tracks = await db.getTracksByProject(p.id);
        const reviewedCount = tracks.filter(t => t.status === "reviewed").length;
        result.push({ ...p, trackCount: tracks.length, reviewedCount });
      }
      return result;
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
        type: z.enum(["single", "album"]),
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
  }),

  track: router({
    upload: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        fileBase64: z.string(),
        fileSize: z.number(),
        trackOrder: z.number().optional(),
        parentTrackId: z.number().optional(),
        versionNumber: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        if (user && user.audioMinutesUsed >= user.audioMinutesLimit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `Audio limit reached (${user.audioMinutesLimit} min). Upgrade for more.` });
        }
        const fileBuffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `audio/${ctx.user.id}/${input.projectId}/${nanoid()}-${input.filename}`;
        const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);
        let trackOrder = input.trackOrder ?? 0;
        if (trackOrder === 0) {
          const existingTracks = await db.getTracksByProject(input.projectId);
          trackOrder = existingTracks.length + 1;
        }
        const track = await db.createTrack({
          projectId: input.projectId,
          userId: ctx.user.id,
          filename: fileKey.split("/").pop()!,
          originalFilename: input.filename,
          storageUrl: url,
          storageKey: fileKey,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          trackOrder,
          versionNumber: input.versionNumber ?? 1,
          parentTrackId: input.parentTrackId ?? null,
        });
        return { trackId: track.id, storageUrl: url };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.id);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const features = await db.getAudioFeaturesByTrack(track.id);
        const reviews = await db.getReviewsByTrack(track.id);
        const trackLyrics = await db.getLyricsByTrack(track.id);
        const childVersions = await db.getTrackVersions(track.id);
        const parentVersions = track.parentTrackId ? await db.getTrackVersions(track.parentTrackId) : [];
        return { track, features, reviews, lyrics: trackLyrics, versions: [...parentVersions, ...childVersions] };
      }),

    getVersions: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const parentId = track.parentTrackId || track.id;
        const parentTrack = await db.getTrackById(parentId);
        const childVersions = await db.getTrackVersions(parentId);
        return parentTrack ? [parentTrack, ...childVersions] : childVersions;
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

  job: router({
    analyze: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const activeJob = await db.getActiveJobForTrack(input.trackId);
        if (activeJob) {
          throw new TRPCError({ code: "CONFLICT", message: "Track is already being processed" });
        }
        const job = await db.createJob({
          projectId: track.projectId,
          trackId: track.id,
          userId: ctx.user.id,
          type: "analyze",
        });
        enqueueJob(job.id);
        return { jobId: job.id };
      }),

    review: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Track must be analyzed first." });
        }
        const job = await db.createJob({
          projectId: track.projectId,
          trackId: track.id,
          userId: ctx.user.id,
          type: "review",
        });
        enqueueJob(job.id);
        return { jobId: job.id };
      }),

    albumReview: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const job = await db.createJob({
          projectId: input.projectId,
          trackId: null,
          userId: ctx.user.id,
          type: "album_review",
        });
        enqueueJob(job.id);
        return { jobId: job.id };
      }),

    compare: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        if (!track.parentTrackId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No previous version to compare" });
        }
        const job = await db.createJob({
          projectId: track.projectId,
          trackId: track.id,
          userId: ctx.user.id,
          type: "compare",
        });
        enqueueJob(job.id);
        return { jobId: job.id };
      }),

    status: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const job = await db.getJobById(input.id);
        if (!job || job.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }
        return job;
      }),

    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return db.getJobsByProject(input.projectId);
      }),
  }),

  review: router({
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.id);
        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        }
        return review;
      }),

    listByTrack: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        return db.getReviewsByTrack(input.trackId);
      }),

    albumReview: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return db.getAlbumReview(input.projectId);
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
        return db.getConversationByReview(input.reviewId);
      }),

    send: protectedProcedure
      .input(z.object({
        reviewId: z.number(),
        message: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.reviewId);
        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        }
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

        // Generate follow-up response
        const response = await generateFollowUp({
          reviewMarkdown: review.reviewMarkdown || "",
          audioAnalysisJson: features?.geminiAnalysisJson || {},
          trackTitle: track?.originalFilename || "Unknown Track",
          conversationHistory,
          userMessage: input.message,
        });

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

    compare: protectedProcedure
      .input(z.object({ referenceId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ref = await db.getReferenceTrackById(input.referenceId);
        if (!ref || ref.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Reference track not found" });
        }
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
        const comparisonMarkdown = await generateReferenceComparison({
          trackTitle: track.originalFilename,
          referenceFilename: ref.filename,
          trackAudioAnalysis: features?.geminiAnalysisJson || {},
          referenceAudioAnalysis: geminiResult.referenceAnalysis,
          geminiComparison: geminiResult.comparison,
        });

        await db.updateReferenceTrackComparison(ref.id, comparisonMarkdown);
        return { comparisonResult: comparisonMarkdown };
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

  usage: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        audioMinutesUsed: user.audioMinutesUsed,
        audioMinutesLimit: user.audioMinutesLimit,
        tier: user.tier,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
