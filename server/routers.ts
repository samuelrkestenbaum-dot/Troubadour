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

    retry: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const oldJob = await db.getJobById(input.jobId);
        if (!oldJob || oldJob.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }
        if (oldJob.status !== "error") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed jobs can be retried" });
        }
        // Reset the track status if needed
        if (oldJob.trackId) {
          const track = await db.getTrackById(oldJob.trackId);
          if (track) {
            if (oldJob.type === "analyze") {
              await db.updateTrackStatus(track.id, "uploaded");
            } else if (oldJob.type === "review") {
              await db.updateTrackStatus(track.id, "analyzed");
            }
          }
        }
        // Create a new job with the same parameters
        const newJob = await db.createJob({
          projectId: oldJob.projectId,
          trackId: oldJob.trackId,
          userId: ctx.user.id,
          type: oldJob.type,
        });
        enqueueJob(newJob.id);
        return { jobId: newJob.id };
      }),

    analyzeAndReview: protectedProcedure
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
        // Create analyze job first
        const analyzeJob = await db.createJob({
          projectId: track.projectId,
          trackId: track.id,
          userId: ctx.user.id,
          type: "analyze",
        });
        // Create review job (will be queued after analyze completes)
        const reviewJob = await db.createJob({
          projectId: track.projectId,
          trackId: track.id,
          userId: ctx.user.id,
          type: "review",
        });
        enqueueJob(analyzeJob.id);
        enqueueJob(reviewJob.id);
        return { analyzeJobId: analyzeJob.id, reviewJobId: reviewJob.id };
      }),

    batchReviewAll: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const tracks = await db.getTracksByProject(input.projectId);
        const unreviewedTracks = tracks.filter(t => t.status !== "reviewed" && t.status !== "reviewing" && t.status !== "analyzing");
        if (unreviewedTracks.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "All tracks have already been reviewed" });
        }
        // Generate a unique batchId to track batch completion
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const queuedJobs: { trackId: number; analyzeJobId: number; reviewJobId: number }[] = [];
        for (const track of unreviewedTracks) {
          const activeJob = await db.getActiveJobForTrack(track.id);
          if (activeJob) continue; // skip tracks already being processed
          const needsAnalysis = track.status === "uploaded" || track.status === "error";
          if (needsAnalysis) {
            const analyzeJob = await db.createJob({
              projectId: track.projectId,
              trackId: track.id,
              userId: ctx.user.id,
              type: "analyze",
              batchId,
            });
            const reviewJob = await db.createJob({
              projectId: track.projectId,
              trackId: track.id,
              userId: ctx.user.id,
              type: "review",
              batchId,
            });
            enqueueJob(analyzeJob.id);
            enqueueJob(reviewJob.id);
            queuedJobs.push({ trackId: track.id, analyzeJobId: analyzeJob.id, reviewJobId: reviewJob.id });
          } else if (track.status === "analyzed") {
            const reviewJob = await db.createJob({
              projectId: track.projectId,
              trackId: track.id,
              userId: ctx.user.id,
              type: "review",
              batchId,
            });
            enqueueJob(reviewJob.id);
            queuedJobs.push({ trackId: track.id, analyzeJobId: 0, reviewJobId: reviewJob.id });
          }
        }
        return { queued: queuedJobs.length, batchId, jobs: queuedJobs };
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
        // Include detected genre from the track if this is a track review
        let genreInsight: { detectedGenre: string | null; detectedSubgenres: string | null; detectedInfluences: string | null } | null = null;
        if (review.trackId) {
          const track = await db.getTrackById(review.trackId);
          if (track) {
            genreInsight = {
              detectedGenre: track.detectedGenre,
              detectedSubgenres: track.detectedSubgenres,
              detectedInfluences: track.detectedInfluences,
            };
          }
        }
        return { ...review, genreInsight };
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

    versionDiff: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        if (!track.parentTrackId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This track has no previous version to compare" });
        }
        const parentTrack = await db.getTrackById(track.parentTrackId);
        if (!parentTrack) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Parent track not found" });
        }
        const currentReviews = await db.getReviewsByTrack(track.id);
        const parentReviews = await db.getReviewsByTrack(parentTrack.id);
        const currentReview = currentReviews.find(r => r.reviewType === "track");
        const parentReview = parentReviews.find(r => r.reviewType === "track");
        // Find comparison review
        const comparisonReviews = currentReviews.filter(r => r.reviewType === "comparison");
        const comparisonReview = comparisonReviews.length > 0 ? comparisonReviews[comparisonReviews.length - 1] : null;
        // Calculate score deltas
        const currentScores = (currentReview?.scoresJson as Record<string, number>) || {};
        const parentScores = (parentReview?.scoresJson as Record<string, number>) || {};
        const allKeys = Array.from(new Set([...Object.keys(currentScores), ...Object.keys(parentScores)]));
        const deltas: Record<string, { previous: number | null; current: number | null; delta: number }> = {};
        for (const key of allKeys) {
          const prev = parentScores[key] ?? null;
          const curr = currentScores[key] ?? null;
          deltas[key] = {
            previous: prev,
            current: curr,
            delta: (curr ?? 0) - (prev ?? 0),
          };
        }
        return {
          currentTrack: { id: track.id, filename: track.originalFilename, versionNumber: track.versionNumber, genre: track.detectedGenre },
          parentTrack: { id: parentTrack.id, filename: parentTrack.originalFilename, versionNumber: parentTrack.versionNumber, genre: parentTrack.detectedGenre },
          currentReview: currentReview ? { id: currentReview.id, quickTake: currentReview.quickTake, scores: currentScores } : null,
          parentReview: parentReview ? { id: parentReview.id, quickTake: parentReview.quickTake, scores: parentScores } : null,
          comparisonReview: comparisonReview ? { id: comparisonReview.id, markdown: comparisonReview.reviewMarkdown, quickTake: comparisonReview.quickTake } : null,
          deltas,
        };
      }),

    exportMarkdown: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.id);
        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        }
        let trackName = "Unknown Track";
        let genreLine = "";
        if (review.trackId) {
          const track = await db.getTrackById(review.trackId);
          if (track) {
            trackName = track.originalFilename;
            if (track.detectedGenre) {
              genreLine = `**Genre:** ${track.detectedGenre}`;
              if (track.detectedSubgenres) genreLine += ` | ${track.detectedSubgenres}`;
              genreLine += "\n";
            }
          }
        }
        const scores = review.scoresJson as Record<string, number> | null;
        let scoresTable = "";
        if (scores && Object.keys(scores).length > 0) {
          scoresTable = "\n## Scores\n\n| Category | Score |\n|----------|-------|\n";
          for (const [k, v] of Object.entries(scores)) {
            scoresTable += `| ${k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()} | ${v}/10 |\n`;
          }
        }
        const exportMd = `# FirstSpin.ai Review — ${trackName}\n\n${genreLine}${review.quickTake ? `> ${review.quickTake}\n\n` : ""}${scoresTable}\n${review.reviewMarkdown || ""}\n\n---\n*Generated by FirstSpin.ai on ${new Date(review.createdAt).toLocaleDateString()}*\n`;
        return { markdown: exportMd, filename: `firstspin-review-${trackName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.md` };
      }),

    generateShareLink: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.id);
        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        }
        if (review.shareToken) {
          return { shareToken: review.shareToken };
        }
        const token = nanoid(24);
        await db.setReviewShareToken(input.id, token);
        return { shareToken: token };
      }),

    history: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        return db.getReviewHistory(input.trackId);
      }),

    getPublic: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const review = await db.getReviewByShareToken(input.token);
        if (!review) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found or link has expired" });
        }
        let trackName = "Unknown Track";
        let genreInsight: { detectedGenre: string | null; detectedSubgenres: string | null; detectedInfluences: string | null } | null = null;
        if (review.trackId) {
          const track = await db.getTrackById(review.trackId);
          if (track) {
            trackName = track.originalFilename;
            genreInsight = {
              detectedGenre: track.detectedGenre,
              detectedSubgenres: track.detectedSubgenres,
              detectedInfluences: track.detectedInfluences,
            };
          }
        }
        return {
          reviewType: review.reviewType,
          reviewMarkdown: review.reviewMarkdown,
          scoresJson: review.scoresJson,
          quickTake: review.quickTake,
          createdAt: review.createdAt,
          trackName,
          genreInsight,
        };
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
        const comparisonMarkdown = await generateReferenceComparison(
          track.originalFilename,
          (features?.geminiAnalysisJson || {}) as any,
          geminiResult.referenceAnalysis as any,
          geminiResult.comparison,
        );

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

  chat: router({
    createSession: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        trackId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
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
        const contextParts: string[] = ["You are FirstSpin.ai's music advisor — a world-class music critic, producer, and A&R executive. You have access to the user's project data and audio analysis. Be specific, honest, and actionable. Reference actual data when available."];

        if (input.projectId) {
          const project = await db.getProjectById(input.projectId);
          if (project) {
            contextParts.push(`\nProject: "${project.title}" (${project.type}, ${project.genre || "no genre specified"})`);
            if (project.intentNotes) contextParts.push(`Artist intent: ${project.intentNotes}`);
            if (project.referenceArtists) contextParts.push(`Reference artists: ${project.referenceArtists}`);
            if (project.reviewFocus) contextParts.push(`Review focus: ${project.reviewFocus}`);
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

    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        message: z.string().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getChatSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
        }

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
        const { callClaude } = await import("./services/claudeCritic");
        const systemPrompt = systemMsg?.content || "You are FirstSpin.ai's music advisor. Be specific, honest, and actionable.";
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
