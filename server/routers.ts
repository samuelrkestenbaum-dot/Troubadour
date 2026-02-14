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

// ── Usage gating helper ──
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac",
  "audio/ogg", "audio/flac", "audio/webm",
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

async function assertUsageAllowed(userId: number) {
  // Auto-reset monthly counters if needed
  await db.resetMonthlyUsageIfNeeded(userId);
  const user = await db.getUserById(userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  if (user.audioMinutesUsed >= user.audioMinutesLimit) {
    const tierLabel = user.tier === "free" ? "Free" : user.tier === "artist" ? "Artist" : "Pro";
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've used ${user.audioMinutesUsed} of your ${user.audioMinutesLimit} minute ${tierLabel} plan limit. Upgrade your plan for more capacity.`,
    });
  }
}

// ── Feature gating helper ──
import { isFeatureGated, PLANS, getPlanByTier } from "./stripe/products";

function assertFeatureAllowed(tier: string, feature: string) {
  if (isFeatureGated(tier, feature)) {
    const requiredTier = (PLANS.artist.gatedFeatures as readonly string[]).includes(feature) ? "Artist" : "Pro";
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This feature requires the ${requiredTier} plan. Upgrade at /pricing to unlock it.`,
    });
  }
}

async function assertMonthlyReviewAllowed(userId: number) {
  await db.resetMonthlyUsageIfNeeded(userId);
  const user = await db.getUserById(userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  const plan = getPlanByTier(user.tier);
  if (user.monthlyReviewCount >= plan.monthlyReviewLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've used ${user.monthlyReviewCount} of your ${plan.monthlyReviewLimit} monthly reviews on the ${plan.name} plan. Upgrade for unlimited reviews.`,
    });
  }
}

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
        // Usage gating
        await assertUsageAllowed(ctx.user.id);
        // File validation
        if (!ALLOWED_AUDIO_TYPES.has(input.mimeType.toLowerCase())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported audio format: ${input.mimeType}. Supported: MP3, WAV, M4A, AAC, OGG, FLAC, WebM.` });
        }
        if (input.fileSize > MAX_FILE_SIZE) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `File too large (${Math.round(input.fileSize / 1024 / 1024)}MB). Maximum: 50MB.` });
        }
        const fileBuffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `audio/${ctx.user.id}/${input.projectId}/${nanoid()}-${input.filename}`;
        const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);
        let trackOrder = input.trackOrder ?? 0;
        const existingTracks = await db.getTracksByProject(input.projectId);
        if (trackOrder === 0) {
          trackOrder = existingTracks.length + 1;
        }
        // Server-side version numbering: compute from DB, ignore client-sent value
        let versionNumber = 1;
        if (input.parentTrackId) {
          const siblings = existingTracks.filter(t => t.parentTrackId === input.parentTrackId || t.id === input.parentTrackId);
          versionNumber = siblings.length + 1;
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
          versionNumber,
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
        // Include latest job error for error surfacing in UI
        const latestJob = await db.getLatestJobForTrack(track.id);
        const jobError = latestJob?.status === "error" ? latestJob.errorMessage : null;
        return { track, features, reviews, lyrics: trackLyrics, versions: [...parentVersions, ...childVersions], jobError };
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
        if (!parentTrack || parentTrack.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const childVersions = await db.getTrackVersions(parentId);
        return [parentTrack, ...childVersions];
      }),
  }),

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

    addTag: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        tag: z.string().min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const existing = await db.getTrackTags(input.trackId);
        if (!existing.includes(input.tag)) {
          existing.push(input.tag);
          await db.updateTrackTags(input.trackId, existing);
        }
        return { success: true, tags: existing };
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
        await assertUsageAllowed(ctx.user.id);
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
        await assertUsageAllowed(ctx.user.id);
        await assertMonthlyReviewAllowed(ctx.user.id);
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
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "album_review");
        await assertUsageAllowed(ctx.user.id);
        await assertMonthlyReviewAllowed(ctx.user.id);
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
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "version_comparison");
        await assertMonthlyReviewAllowed(ctx.user.id);
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
          if (track && track.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
          }
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
      .input(z.object({ trackId: z.number(), templateId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        await assertUsageAllowed(ctx.user.id);
        await assertMonthlyReviewAllowed(ctx.user.id);
        const activeJob = await db.getActiveJobForTrack(input.trackId);
        if (activeJob) {
          throw new TRPCError({ code: "CONFLICT", message: "Track is already being processed" });
        }
        // If templateId provided, validate it belongs to user
        let templateFocusAreas: string[] | undefined;
        if (input.templateId) {
          const template = await db.getReviewTemplateById(input.templateId);
          if (!template || template.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
          }
          templateFocusAreas = template.focusAreas as string[];
        }
        const jobMetadata = templateFocusAreas ? { templateId: input.templateId, focusAreas: templateFocusAreas } : undefined;
        // Create analyze job first
        const analyzeJob = await db.createJob({
          projectId: track.projectId,
          trackId: track.id,
          userId: ctx.user.id,
          type: "analyze",
          metadata: jobMetadata,
        });
        // Create review job — depends on analyze completing first
        const reviewJob = await db.createJob({
          projectId: track.projectId,
          trackId: track.id,
          userId: ctx.user.id,
          type: "review",
          dependsOnJobId: analyzeJob.id,
          metadata: jobMetadata,
        });
        enqueueJob(analyzeJob.id);
        enqueueJob(reviewJob.id);
        return { analyzeJobId: analyzeJob.id, reviewJobId: reviewJob.id };
      }),

    batchReviewAll: protectedProcedure
      .input(z.object({ projectId: z.number(), templateId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "batch_review");
        await assertMonthlyReviewAllowed(ctx.user.id);
        // If templateId provided, validate it belongs to user
        let jobMetadata: Record<string, any> | undefined;
        if (input.templateId) {
          const template = await db.getReviewTemplateById(input.templateId);
          if (!template || template.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
          }
          jobMetadata = { templateId: input.templateId, focusAreas: template.focusAreas as string[] };
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
              metadata: jobMetadata,
            });
            const reviewJob = await db.createJob({
              projectId: track.projectId,
              trackId: track.id,
              userId: ctx.user.id,
              type: "review",
              batchId,
              dependsOnJobId: analyzeJob.id,
              metadata: jobMetadata,
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
              metadata: jobMetadata,
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
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "export");
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
        const exportMd = `# Troubadour Review — ${trackName}\n\n${genreLine}${review.quickTake ? `> ${review.quickTake}\n\n` : ""}${scoresTable}\n${review.reviewMarkdown || ""}\n\n---\n*Generated by Troubadour on ${new Date(review.createdAt).toLocaleDateString()}*\n`;
        return { markdown: exportMd, filename: `troubadour-review-${trackName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.md` };
      }),

    generateShareLink: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.id);
        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "share");
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

    exportHtml: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.reviewId);
        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        }
        const track = review.trackId ? await db.getTrackById(review.trackId) : null;
        const project = await db.getProjectById(review.projectId);
        const scores = review.scoresJson as Record<string, number> | undefined;

        // Convert markdown to basic HTML
        const reviewHtml = review.reviewMarkdown
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/^- (.*$)/gim, '<li>$1</li>')
          .replace(/\n\n/gim, '</p><p>')
          .replace(/\n/gim, '<br>');

        let scoresHtml = '';
        if (scores && Object.keys(scores).length > 0) {
          scoresHtml = `<h2>Scores</h2><div class="scores">${Object.entries(scores).map(([k, v]) =>
            `<div class="score-item"><span class="score-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span class="score-value">${v}/10</span></div>`
          ).join('')}</div>`;
        }

        const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Review - ${project?.title || 'Project'} - ${track?.originalFilename || 'Review'}</title><style>
          body{font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#1a1a2e;max-width:800px;margin:0 auto;padding:40px 20px}
          h1{font-size:2em;margin-bottom:0.3em;color:#0f0f23} h2{font-size:1.4em;margin-top:1.5em;color:#1a1a2e;border-bottom:2px solid #e8e8f0;padding-bottom:0.3em}
          h3{font-size:1.15em;margin-top:1.2em;color:#2a2a4a} .header{border-bottom:2px solid #c8102e;padding-bottom:16px;margin-bottom:24px}
          .quick-take{font-style:italic;color:#555;padding:12px 16px;background:#f8f8fc;border-left:4px solid #c8102e;margin:16px 0}
          .scores{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;padding:16px;background:#f8f8fc;border-radius:8px;margin:12px 0}
          .score-item{display:flex;justify-content:space-between;padding:4px 0} .score-label{font-weight:600;color:#555} .score-value{font-weight:700;color:#c8102e}
          blockquote{border-left:4px solid #ddd;padding-left:12px;color:#666;margin:12px 0} li{margin:4px 0}
          @media print{body{padding:20px}}
        </style></head><body>
          <div class="header"><h1>${project?.title || 'Project Review'}</h1>${track ? `<p style="font-size:1.2em;color:#555">Track: ${track.originalFilename}</p>` : ''}<p style="color:#888">Review Type: ${review.reviewType.charAt(0).toUpperCase() + review.reviewType.slice(1)} &middot; ${new Date(review.createdAt).toLocaleDateString()}</p></div>
          ${review.quickTake ? `<div class="quick-take">"${review.quickTake}"</div>` : ''}
          ${scoresHtml}
          <h2>Detailed Review</h2><div><p>${reviewHtml}</p></div>
          <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e8e8f0;color:#999;font-size:0.85em;text-align:center">Generated by Troubadour AI</footer>
        </body></html>`;

        return { htmlContent };
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

    exportAllReviews: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const allTracks = await db.getTracksByProject(input.projectId);
        const allReviews = await db.getReviewsByProject(input.projectId);

        // Build a combined HTML report
        let tracksHtml = '';
        for (const track of allTracks) {
          const trackReview = allReviews.find(r => r.trackId === track.id && r.isLatest && r.reviewType === 'track');
          if (!trackReview) continue;
          const scores = trackReview.scoresJson as Record<string, number> | undefined;
          const reviewHtml = trackReview.reviewMarkdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>');

          let scoresHtml = '';
          if (scores && Object.keys(scores).length > 0) {
            scoresHtml = `<div class="scores">${Object.entries(scores).map(([k, v]) =>
              `<div class="score-item"><span class="score-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span class="score-value">${v}/10</span></div>`
            ).join('')}</div>`;
          }

          tracksHtml += `
            <div class="track-section">
              <h2>${track.originalFilename}</h2>
              ${track.detectedGenre ? `<p class="genre">Genre: ${track.detectedGenre}${track.detectedSubgenres ? ` | ${track.detectedSubgenres}` : ''}</p>` : ''}
              ${trackReview.quickTake ? `<div class="quick-take">"${trackReview.quickTake}"</div>` : ''}
              ${scoresHtml}
              <div class="review-content"><p>${reviewHtml}</p></div>
            </div>
            <hr class="track-divider">`;
        }

        // Album review if exists
        const albumReview = allReviews.find(r => r.reviewType === 'album' && r.isLatest);
        let albumHtml = '';
        if (albumReview) {
          const albumContent = albumReview.reviewMarkdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>');
          albumHtml = `<div class="album-review"><h2>Album Review</h2>${albumReview.quickTake ? `<div class="quick-take">"${albumReview.quickTake}"</div>` : ''}<div class="review-content"><p>${albumContent}</p></div></div>`;
        }

        const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${project.title} - Full Review Report</title><style>
          body{font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#1a1a2e;max-width:800px;margin:0 auto;padding:40px 20px}
          h1{font-size:2em;margin-bottom:0.3em;color:#0f0f23} h2{font-size:1.4em;margin-top:1.5em;color:#1a1a2e;border-bottom:2px solid #e8e8f0;padding-bottom:0.3em}
          h3{font-size:1.15em;margin-top:1.2em;color:#2a2a4a} .header{border-bottom:2px solid #c8102e;padding-bottom:16px;margin-bottom:24px}
          .quick-take{font-style:italic;color:#555;padding:12px 16px;background:#f8f8fc;border-left:4px solid #c8102e;margin:16px 0}
          .scores{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;padding:16px;background:#f8f8fc;border-radius:8px;margin:12px 0}
          .score-item{display:flex;justify-content:space-between;padding:4px 0} .score-label{font-weight:600;color:#555} .score-value{font-weight:700;color:#c8102e}
          blockquote{border-left:4px solid #ddd;padding-left:12px;color:#666;margin:12px 0} li{margin:4px 0}
          .track-section{margin:24px 0} .track-divider{border:none;border-top:2px solid #e8e8f0;margin:32px 0}
          .genre{color:#888;font-size:0.9em;margin-top:-8px} .album-review{margin-top:40px;padding-top:24px;border-top:3px solid #c8102e}
          @media print{body{padding:20px} .track-section{page-break-inside:avoid}}
        </style></head><body>
          <div class="header">
            <h1>${project.title}</h1>
            <p style="color:#888">${allTracks.length} track${allTracks.length !== 1 ? 's' : ''} &middot; ${project.type.charAt(0).toUpperCase() + project.type.slice(1)} &middot; ${new Date().toLocaleDateString()}</p>
          </div>
          ${tracksHtml}
          ${albumHtml}
          <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e8e8f0;color:#999;font-size:0.85em;text-align:center">Generated by Troubadour AI</footer>
        </body></html>`;

        return { htmlContent };
      }),
  }),

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

    compare: protectedProcedure
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
        const { callClaude } = await import("./services/claudeCritic");
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
  }),

  analytics: router({
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
  }),

  usage: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const plan = getPlanByTier(user.tier);
      // Compute next reset date (1st of next month)
      const resetAt = new Date(user.monthlyResetAt);
      const nextReset = new Date(resetAt.getFullYear(), resetAt.getMonth() + 1, 1);
      return {
        audioMinutesUsed: user.audioMinutesUsed,
        audioMinutesLimit: user.audioMinutesLimit,
        tier: user.tier,
        monthlyReviewCount: user.monthlyReviewCount,
        monthlyReviewLimit: plan.monthlyReviewLimit,
        monthlyResetDate: nextReset.toISOString(),
      };
    }),
  }),

  subscription: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      let subscriptionDetails = null;
      if (user.stripeSubscriptionId) {
        try {
          const { getSubscriptionDetails } = await import("./stripe/stripe");
          subscriptionDetails = await getSubscriptionDetails(user.stripeSubscriptionId);
        } catch { /* Stripe not configured */ }
      }
      return {
        tier: user.tier,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        audioMinutesUsed: user.audioMinutesUsed,
        audioMinutesLimit: user.audioMinutesLimit,
        subscription: subscriptionDetails,
      };
    }),

    checkout: protectedProcedure
      .input(z.object({
        plan: z.enum(["artist", "pro"]),
        origin: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (!user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Email required for checkout" });

        const { PLANS } = await import("./stripe/products");
        const plan = PLANS[input.plan];

        // Create or get Stripe products/prices dynamically
        const { getStripe, createCheckoutSession } = await import("./stripe/stripe");
        const stripe = getStripe();

        // Find or create the price
        let priceId: string = plan.stripePriceId as string;
        if (!priceId) {
          // Search for existing product
          const products = await stripe.products.list({ limit: 10 });
          let product = products.data.find(p => p.metadata?.tier === input.plan);
          if (!product) {
            product = await stripe.products.create({
              name: `Troubadour ${plan.name}`,
              description: `${plan.name} plan - ${plan.features.join(", ")}`,
              metadata: { tier: input.plan },
            });
          }
          // Find or create price
          const prices = await stripe.prices.list({ product: product.id, active: true, limit: 5 });
          const existingPrice = prices.data.find(p => p.unit_amount === plan.priceMonthly && p.recurring?.interval === "month");
          if (existingPrice) {
            priceId = existingPrice.id;
          } else {
            const newPrice = await stripe.prices.create({
              product: product.id,
              unit_amount: plan.priceMonthly,
              currency: "usd",
              recurring: { interval: "month" },
            });
            priceId = newPrice.id;
          }
        }

        const { url } = await createCheckoutSession({
          userId: ctx.user.id,
          email: user.email,
          name: user.name ?? undefined,
          stripeCustomerId: user.stripeCustomerId,
          priceId,
          origin: input.origin,
        });

        return { url };
      }),

    manageBilling: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (!user.stripeCustomerId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found" });
        }
        const { createBillingPortalSession } = await import("./stripe/stripe");
        const { url } = await createBillingPortalSession({
          stripeCustomerId: user.stripeCustomerId,
          origin: input.origin,
        });
        return { url };
      }),

    deleteAccount: protectedProcedure
      .input(z.object({ confirmation: z.literal("DELETE") }))
      .mutation(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });

        // Cancel active Stripe subscription if exists
        if (user.stripeSubscriptionId) {
          try {
            const { getStripe } = await import("./stripe/stripe");
            const stripe = getStripe();
            await stripe.subscriptions.cancel(user.stripeSubscriptionId);
            console.log(`[DeleteAccount] Cancelled Stripe subscription ${user.stripeSubscriptionId} for user ${user.id}`);
          } catch (err: any) {
            console.warn(`[DeleteAccount] Failed to cancel Stripe subscription: ${err.message}`);
            // Continue with deletion even if Stripe cancel fails
          }
        }

        // Soft-delete the user (sets deletedAt, clears subscription data, zeroes limits)
        await db.softDeleteUser(user.id);
        console.log(`[DeleteAccount] Soft-deleted user ${user.id} (${user.email})`);

        // Clear the session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

        return { success: true };
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

  // ── Collaboration ──
  collaboration: router({
    invite: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        email: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can invite collaborators" });
        }
        if (input.email === ctx.user.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot invite yourself" });
        }
        const existing = await db.getCollaboratorsByProject(input.projectId);
        if (existing.some(c => c.invitedEmail === input.email)) {
          throw new TRPCError({ code: "CONFLICT", message: "This email has already been invited" });
        }
        const inviteToken = nanoid(32);
        const invitedUser = await db.getUserByEmail(input.email);
        const result = await db.createCollaboratorInvite({
          projectId: input.projectId,
          invitedEmail: input.email,
          invitedUserId: invitedUser?.id || null,
          inviteToken,
          status: invitedUser ? "accepted" : "pending",
        });

        // Send email notification (fire-and-forget, non-blocking)
        const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, '') || '';
        const inviteUrl = `${origin}/invite/${inviteToken}`;
        import("./services/emailNotification").then(({ sendCollaborationInvite }) => {
          sendCollaborationInvite({
            toEmail: input.email,
            inviterName: ctx.user.name || ctx.user.email || "Someone",
            projectTitle: project.title,
            inviteUrl,
          }).catch(err => console.error("[Email] invite send failed:", err));
        }).catch(err => console.error("[Email] import failed:", err));

        return { success: true, inviteToken, autoAccepted: !!invitedUser };
      }),

    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        const isOwner = project.userId === ctx.user.id;
        const isCollab = await db.isUserCollaborator(ctx.user.id, input.projectId);
        if (!isOwner && !isCollab) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getCollaboratorsByProject(input.projectId);
      }),

    accept: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const invite = await db.getCollaboratorByToken(input.token);
        if (!invite) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or expired" });
        }
        if (invite.status === "accepted") {
          return { success: true, projectId: invite.projectId, alreadyAccepted: true };
        }
        await db.acceptCollaboratorInvite(input.token, ctx.user.id);
        return { success: true, projectId: invite.projectId, alreadyAccepted: false };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number(), projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can remove collaborators" });
        }
        await db.removeCollaborator(input.id);
        return { success: true };
      }),

    sharedProjects: protectedProcedure.query(async ({ ctx }) => {
      const sharedIds = await db.getSharedProjectIds(ctx.user.id);
      if (sharedIds.length === 0) return [];
      const results = [];
      for (const id of sharedIds) {
        const project = await db.getProjectById(id);
        if (project) results.push(project);
      }
      return results;
    }),
  }),
});

export type AppRouter = typeof appRouter;
