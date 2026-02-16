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
import { generateMixReport, generateStructureAnalysis, generateDAWSessionNotes, aggregateGenreBenchmarks, generateProjectInsights } from "./services/analysisService";
import { invokeLLM } from "./_core/llm";
import { eq, and, asc, desc } from "drizzle-orm";
import { sanitizeText, sanitizeUrl } from "./sanitize";

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

    deleteTrack: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.id);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        await db.deleteTrack(input.id);
        return { success: true };
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

    reReview: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        templateId: z.number().optional(),
        reviewLength: z.enum(["brief", "standard", "detailed"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        await assertUsageAllowed(ctx.user.id);
        await assertMonthlyReviewAllowed(ctx.user.id);
        // Require existing analysis
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Track must be analyzed first." });
        }
        const activeJob = await db.getActiveJobForTrack(input.trackId);
        if (activeJob) {
          throw new TRPCError({ code: "CONFLICT", message: "Track is already being processed" });
        }
        // Build metadata with template info
        let templateFocusAreas: string[] | undefined;
        if (input.templateId) {
          const template = await db.getReviewTemplateById(input.templateId);
          if (!template || template.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
          }
          templateFocusAreas = template.focusAreas as string[];
        }
        const jobMetadataObj: Record<string, any> = {};
        if (input.templateId) { jobMetadataObj.templateId = input.templateId; }
        if (templateFocusAreas) { jobMetadataObj.focusAreas = templateFocusAreas; }
        if (input.reviewLength) { jobMetadataObj.reviewLength = input.reviewLength; }
        const jobMetadata = Object.keys(jobMetadataObj).length > 0 ? jobMetadataObj : undefined;
        const job = await db.createJob({
          projectId: track.projectId,
          trackId: track.id,
          userId: ctx.user.id,
          type: "review",
          metadata: jobMetadata,
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
      .input(z.object({ trackId: z.number(), templateId: z.number().optional(), reviewLength: z.enum(["brief", "standard", "detailed"]).optional() }))
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
        const jobMetadataObj: Record<string, any> = {};
        if (templateFocusAreas) { jobMetadataObj.templateId = input.templateId; jobMetadataObj.focusAreas = templateFocusAreas; }
        if (input.reviewLength) { jobMetadataObj.reviewLength = input.reviewLength; }
        const jobMetadata = Object.keys(jobMetadataObj).length > 0 ? jobMetadataObj : undefined;
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
      .input(z.object({ projectId: z.number(), templateId: z.number().optional(), reviewLength: z.enum(["brief", "standard", "detailed"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "batch_review");
        await assertMonthlyReviewAllowed(ctx.user.id);
        // If templateId provided, validate it belongs to user
        const batchMetadata: Record<string, any> = {};
        if (input.templateId) {
          const template = await db.getReviewTemplateById(input.templateId);
          if (!template || template.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
          }
          batchMetadata.templateId = input.templateId;
          batchMetadata.focusAreas = template.focusAreas as string[];
        }
        if (input.reviewLength) { batchMetadata.reviewLength = input.reviewLength; }
        const jobMetadata = Object.keys(batchMetadata).length > 0 ? batchMetadata : undefined;
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

    batchReReview: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        templateId: z.number().optional(),
        reviewLength: z.enum(["brief", "standard", "detailed"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "batch_review");
        // Build metadata
        const batchMetadata: Record<string, any> = {};
        if (input.templateId) {
          const template = await db.getReviewTemplateById(input.templateId);
          if (!template || template.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
          }
          batchMetadata.templateId = input.templateId;
          batchMetadata.focusAreas = template.focusAreas as string[];
        }
        if (input.reviewLength) { batchMetadata.reviewLength = input.reviewLength; }
        const jobMetadata = Object.keys(batchMetadata).length > 0 ? batchMetadata : undefined;
        const tracks = await db.getTracksByProject(input.projectId);
        const reviewedTracks = tracks.filter(t => t.status === "reviewed");
        if (reviewedTracks.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No reviewed tracks to re-review" });
        }
        const batchId = `rereview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let queued = 0;
        for (const track of reviewedTracks) {
          const activeJob = await db.getActiveJobForTrack(track.id);
          if (activeJob) continue;
          // Check that analysis exists
          const features = await db.getAudioFeaturesByTrack(track.id);
          if (!features?.geminiAnalysisJson) continue;
          const job = await db.createJob({
            projectId: track.projectId,
            trackId: track.id,
            userId: ctx.user.id,
            type: "review",
            batchId,
            metadata: jobMetadata,
          });
          enqueueJob(job.id);
          queued++;
        }
        return { queued, batchId };
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

    reviewDiff: protectedProcedure
      .input(z.object({ reviewIdA: z.number(), reviewIdB: z.number() }))
      .query(async ({ ctx, input }) => {
        const reviewA = await db.getReviewById(input.reviewIdA);
        const reviewB = await db.getReviewById(input.reviewIdB);
        if (!reviewA || reviewA.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review A not found" });
        }
        if (!reviewB || reviewB.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Review B not found" });
        }
        const scoresA = (reviewA.scoresJson as Record<string, number>) || {};
        const scoresB = (reviewB.scoresJson as Record<string, number>) || {};
        const allKeys = Array.from(new Set([...Object.keys(scoresA), ...Object.keys(scoresB)]));
        const scoreDeltas: Record<string, { old: number | null; new_: number | null; delta: number }> = {};
        for (const key of allKeys) {
          const oldVal = scoresA[key] ?? null;
          const newVal = scoresB[key] ?? null;
          scoreDeltas[key] = {
            old: oldVal,
            new_: newVal,
            delta: (newVal ?? 0) - (oldVal ?? 0),
          };
        }
        return {
          reviewA: {
            id: reviewA.id,
            reviewVersion: reviewA.reviewVersion,
            reviewMarkdown: reviewA.reviewMarkdown,
            quickTake: reviewA.quickTake,
            scores: scoresA,
            createdAt: reviewA.createdAt,
          },
          reviewB: {
            id: reviewB.id,
            reviewVersion: reviewB.reviewVersion,
            reviewMarkdown: reviewB.reviewMarkdown,
            quickTake: reviewB.quickTake,
            scores: scoresB,
            createdAt: reviewB.createdAt,
          },
          scoreDeltas,
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

    exportHistory: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        }
        const allReviews = await db.getReviewsByTrack(input.trackId);
        const trackReviews = allReviews
          .filter(r => r.reviewType === "track")
          .sort((a, b) => (a.reviewVersion ?? 1) - (b.reviewVersion ?? 1));
        if (trackReviews.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No reviews found for this track" });
        }
        const markdownToHtml = (md: string) => md
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/^- (.*$)/gim, '<li>$1</li>')
          .replace(/\n\n/gim, '</p><p>')
          .replace(/\n/gim, '<br>');
        let versionsHtml = '';
        for (const review of trackReviews) {
          const scores = review.scoresJson as Record<string, number> | undefined;
          let scoresHtml = '';
          if (scores && Object.keys(scores).length > 0) {
            scoresHtml = `<div class="scores">${Object.entries(scores).map(([k, v]) =>
              `<div class="score-item"><span class="score-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span class="score-value">${v}/10</span></div>`
            ).join('')}</div>`;
          }
          const reviewHtml = markdownToHtml(review.reviewMarkdown);
          const date = new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          versionsHtml += `
            <div class="version-section">
              <div class="version-header">
                <span class="version-badge">Version ${review.reviewVersion ?? 1}</span>
                <span class="version-date">${date}</span>
                ${review.isLatest ? '<span class="latest-badge">Latest</span>' : ''}
              </div>
              ${review.quickTake ? `<div class="quick-take">"${review.quickTake}"</div>` : ''}
              ${scoresHtml}
              <div class="review-content"><p>${reviewHtml}</p></div>
            </div>
            <hr class="version-divider">`;
        }
        // Score comparison summary
        let comparisonHtml = '';
        if (trackReviews.length >= 2) {
          const first = trackReviews[0].scoresJson as Record<string, number> | undefined;
          const last = trackReviews[trackReviews.length - 1].scoresJson as Record<string, number> | undefined;
          if (first && last) {
            const dims = Object.keys(last);
            comparisonHtml = `<div class="comparison"><h2>Score Evolution</h2><div class="scores">${dims.map(k => {
              const delta = (last[k] ?? 0) - (first[k] ?? 0);
              const arrow = delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2192';
              const color = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#888';
              return `<div class="score-item"><span class="score-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span class="score-value" style="color:${color}">${first[k] ?? '-'} ${arrow} ${last[k] ?? '-'}</span></div>`;
            }).join('')}</div></div>`;
          }
        }
        const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${track.originalFilename} - Review History</title><style>
          body{font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#1a1a2e;max-width:800px;margin:0 auto;padding:40px 20px}
          h1{font-size:2em;margin-bottom:0.3em;color:#0f0f23} h2{font-size:1.4em;margin-top:1.5em;color:#1a1a2e;border-bottom:2px solid #e8e8f0;padding-bottom:0.3em}
          h3{font-size:1.15em;margin-top:1.2em;color:#2a2a4a} .header{border-bottom:2px solid #c8102e;padding-bottom:16px;margin-bottom:24px}
          .quick-take{font-style:italic;color:#555;padding:12px 16px;background:#f8f8fc;border-left:4px solid #c8102e;margin:16px 0}
          .scores{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;padding:16px;background:#f8f8fc;border-radius:8px;margin:12px 0}
          .score-item{display:flex;justify-content:space-between;padding:4px 0} .score-label{font-weight:600;color:#555} .score-value{font-weight:700;color:#c8102e}
          blockquote{border-left:4px solid #ddd;padding-left:12px;color:#666;margin:12px 0} li{margin:4px 0}
          .version-section{margin:24px 0} .version-divider{border:none;border-top:2px solid #e8e8f0;margin:32px 0}
          .version-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
          .version-badge{background:#c8102e;color:white;padding:4px 12px;border-radius:20px;font-size:0.85em;font-weight:700}
          .version-date{color:#888;font-size:0.9em} .latest-badge{background:#22c55e;color:white;padding:2px 8px;border-radius:12px;font-size:0.75em;font-weight:600}
          .comparison{margin-top:32px;padding-top:24px;border-top:3px solid #c8102e}
          @media print{body{padding:20px} .version-section{page-break-inside:avoid}}
        </style></head><body>
          <div class="header">
            <h1>${track.originalFilename}</h1>
            <p style="color:#888">${trackReviews.length} review version${trackReviews.length !== 1 ? 's' : ''} &middot; ${track.detectedGenre || 'Unknown genre'} &middot; ${new Date().toLocaleDateString()}</p>
          </div>
          ${comparisonHtml}
          ${versionsHtml}
          <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e8e8f0;color:#999;font-size:0.85em;text-align:center">Generated by Troubadour AI</footer>
        </body></html>`;
        // Also generate markdown version
        let markdown = `# ${track.originalFilename} - Review History\n\n`;
        markdown += `> ${trackReviews.length} review version${trackReviews.length !== 1 ? 's' : ''} | ${track.detectedGenre || 'Unknown genre'} | ${new Date().toLocaleDateString()}\n\n---\n\n`;
        for (const review of trackReviews) {
          const scores = review.scoresJson as Record<string, number> | undefined;
          const date = new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          markdown += `## Version ${review.reviewVersion ?? 1} — ${date}${review.isLatest ? ' (Latest)' : ''}\n\n`;
          if (review.quickTake) markdown += `> ${review.quickTake}\n\n`;
          if (scores) {
            markdown += `| Dimension | Score |\n|-----------|-------|\n`;
            for (const [k, v] of Object.entries(scores)) {
              markdown += `| ${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} | ${v}/10 |\n`;
            }
            markdown += `\n`;
          }
          markdown += review.reviewMarkdown + `\n\n---\n\n`;
        }
        return { htmlContent, markdown, trackName: track.originalFilename, versionCount: trackReviews.length };
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

  // ── Collaboration ──
  collaboration: router({
    invite: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        email: z.string().email(),
        role: z.enum(["viewer", "commenter"]).default("viewer"),
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
          role: input.role,
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

        // Notify project owner that collaborator joined
        try {
          const project = await db.getProjectById(invite.projectId);
          if (project) {
            await db.createNotification({
              userId: project.userId,
              type: "collaboration_accepted",
              title: "Collaborator Joined",
              message: `${ctx.user.name || ctx.user.email || "Someone"} accepted your invite to "${project.title}"`,
              link: `/projects/${project.id}`,
            });
          }
        } catch (e) {
          console.warn("[Collaboration] Notification failed:", e);
        }

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

  // ── Review Comments ──
  comment: router({
    list: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ input }) => {
        return db.getReviewComments(input.reviewId);
      }),

    create: protectedProcedure
      .input(z.object({
        reviewId: z.number(),
        content: z.string().min(1).max(5000),
        parentId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify user has access to this review (owner or commenter collaborator)
        const review = await db.getReviewById(input.reviewId);
        if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        const project = await db.getProjectById(review.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        const isOwner = project.userId === ctx.user.id;
        if (!isOwner) {
          const collab = await db.getCollaboratorRole(ctx.user.id, project.id);
          if (!collab || collab !== "commenter") {
            throw new TRPCError({ code: "FORBIDDEN", message: "You need commenter access to leave comments" });
          }
        }
        const result = await db.createReviewComment({
          reviewId: input.reviewId,
          userId: ctx.user.id,
          content: input.content,
          parentId: input.parentId || null,
        });
        // Notify project owner if commenter
        if (!isOwner) {
          try {
            await db.createNotification({
              userId: project.userId,
              type: "review_complete" as const,
              title: "New Comment on Review",
              message: `${ctx.user.name || ctx.user.email || "A collaborator"} commented on a review in "${project.title}"`,
              link: `/reviews/${input.reviewId}`,
            });
          } catch (e) { console.warn("[Comment] Notification failed:", e); }
        }
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.updateReviewComment(input.id, ctx.user.id, input.content);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteReviewComment(input.id, ctx.user.id);
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

  // ── Mix Report (Feature 3) ──
  mixReport: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        return db.getMixReportByTrack(input.trackId) ?? null;
      }),

    generate: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "mixReport");
        const track = await db.getTrackById(input.trackId);
        if (!track) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Track needs audio analysis first. Run a review to generate analysis." });
        const analysis = features.geminiAnalysisJson as any;
        const trackReviews = await db.getReviewsByTrack(input.trackId);
        const latestReview = trackReviews.length > 0 ? trackReviews[0] : null;
        const report = await generateMixReport(analysis, track.originalFilename, track.detectedGenre || "Unknown", latestReview?.reviewMarkdown);
        const id = await db.createMixReport({
          trackId: input.trackId,
          userId: ctx.user.id,
          reportMarkdown: report.reportMarkdown,
          frequencyAnalysis: report.frequencyAnalysis,
          dynamicsAnalysis: report.dynamicsAnalysis,
          stereoAnalysis: report.stereoAnalysis,
          loudnessData: report.loudnessData,
          dawSuggestions: report.dawSuggestions,
        });
        return { id, ...report };
      }),

    exportHtml: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const report = await db.getMixReportByTrack(input.trackId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "No mix report found. Generate one first." });
        const track = await db.getTrackById(input.trackId);
        const trackName = track?.originalFilename || "Track";

        // Build HTML for PDF-style export
        const freq = report.frequencyAnalysis as any;
        const dynamics = report.dynamicsAnalysis as any;
        const stereo = report.stereoAnalysis as any;
        const loudness = report.loudnessData as any;
        const suggestions = report.dawSuggestions as any[];

        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mix Report - ${trackName}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e; background: #fff; }
  h1 { font-size: 24px; border-bottom: 3px solid #e74c6f; padding-bottom: 12px; margin-bottom: 24px; }
  h2 { font-size: 18px; color: #e74c6f; margin-top: 28px; margin-bottom: 12px; }
  h3 { font-size: 14px; color: #666; margin-top: 16px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
  th { background: #f8f9fa; font-weight: 600; color: #333; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-excellent { background: #d4edda; color: #155724; }
  .badge-good { background: #d1ecf1; color: #0c5460; }
  .badge-adequate { background: #fff3cd; color: #856404; }
  .badge-weak { background: #f8d7da; color: #721c24; }
  .badge-high { background: #f8d7da; color: #721c24; }
  .badge-medium { background: #fff3cd; color: #856404; }
  .badge-low { background: #d1ecf1; color: #0c5460; }
  .lufs-box { display: flex; gap: 32px; align-items: center; padding: 16px; background: #f8f9fa; border-radius: 8px; margin: 12px 0; }
  .lufs-value { text-align: center; }
  .lufs-value .num { font-size: 28px; font-weight: 700; font-family: monospace; }
  .lufs-value .label { font-size: 11px; color: #666; }
  .suggestion { padding: 10px 14px; margin: 6px 0; background: #f8f9fa; border-left: 3px solid #e74c6f; border-radius: 0 6px 6px 0; }
  .suggestion .element { font-weight: 600; }
  .suggestion .issue { color: #666; font-size: 12px; }
  .report-md { line-height: 1.7; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 11px; text-align: center; }
  @media print { body { padding: 20px; } }
</style></head><body>`;

        html += `<h1>Mix Feedback Report</h1>`;
        html += `<div class="meta"><strong>${trackName}</strong> &mdash; Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>`;

        // Frequency Analysis
        if (freq) {
          html += `<h2>Frequency Analysis</h2><table><tr><th>Band</th><th>Rating</th><th>Notes</th></tr>`;
          const bands = [
            { label: "Low End (20–250Hz)", ...(freq.lowEnd || {}) },
            { label: "Mid Range (250Hz–4kHz)", ...(freq.midRange || {}) },
            { label: "High End (4kHz–20kHz)", ...(freq.highEnd || {}) },
          ];
          for (const b of bands) {
            html += `<tr><td>${b.label}</td><td><span class="badge badge-${b.rating || 'adequate'}">${b.rating || 'N/A'}</span></td><td>${b.notes || ''}</td></tr>`;
          }
          html += `</table>`;
          if (freq.overallBalance) html += `<p><strong>Overall Balance:</strong> ${freq.overallBalance}</p>`;
        }

        // Dynamics
        if (dynamics) {
          html += `<h2>Dynamics</h2><table><tr><th>Aspect</th><th>Assessment</th></tr>`;
          if (dynamics.dynamicRange) html += `<tr><td>Dynamic Range</td><td>${dynamics.dynamicRange}</td></tr>`;
          if (dynamics.compression) html += `<tr><td>Compression</td><td>${dynamics.compression}</td></tr>`;
          if (dynamics.transients) html += `<tr><td>Transients</td><td>${dynamics.transients}</td></tr>`;
          if (dynamics.loudness) html += `<tr><td>Loudness</td><td>${dynamics.loudness}</td></tr>`;
          html += `</table>`;
        }

        // Loudness
        if (loudness && typeof loudness.estimatedLUFS === 'number') {
          html += `<h2>Loudness Target</h2>`;
          html += `<div class="lufs-box">`;
          html += `<div class="lufs-value"><div class="num">${loudness.estimatedLUFS}</div><div class="label">Estimated LUFS</div></div>`;
          if (typeof loudness.targetLUFS === 'number') {
            const diff = loudness.estimatedLUFS - loudness.targetLUFS;
            html += `<div class="lufs-value"><div class="num" style="color:${Math.abs(diff) <= 1 ? '#28a745' : Math.abs(diff) <= 3 ? '#ffc107' : '#dc3545'}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</div><div class="label">vs Target</div></div>`;
            html += `<div class="lufs-value"><div class="num">${loudness.targetLUFS}</div><div class="label">Target LUFS</div></div>`;
          }
          html += `</div>`;
          if (loudness.recommendation) html += `<p>${loudness.recommendation}</p>`;
        }

        // Stereo
        if (stereo) {
          html += `<h2>Stereo Image</h2><table><tr><th>Aspect</th><th>Assessment</th></tr>`;
          if (stereo.width) html += `<tr><td>Width</td><td>${stereo.width}</td></tr>`;
          if (stereo.balance) html += `<tr><td>Balance</td><td>${stereo.balance}</td></tr>`;
          if (stereo.monoCompatibility) html += `<tr><td>Mono Compatibility</td><td>${stereo.monoCompatibility}</td></tr>`;
          if (stereo.panningNotes) html += `<tr><td>Panning</td><td>${stereo.panningNotes}</td></tr>`;
          html += `</table>`;
        }

        // DAW Suggestions
        if (suggestions && suggestions.length > 0) {
          html += `<h2>DAW Action Items (${suggestions.length})</h2>`;
          for (const s of suggestions) {
            html += `<div class="suggestion">`;
            html += `<span class="badge badge-${s.priority || 'medium'}">${s.priority || 'medium'}</span> `;
            if (s.timestamp) html += `<span style="font-family:monospace;color:#666;font-size:12px">${s.timestamp}</span> `;
            if (s.element) html += `<span class="element">${s.element}</span>`;
            if (s.issue) html += `<div class="issue">${s.issue}</div>`;
            if (s.suggestion) html += `<div>${s.suggestion}</div>`;
            html += `</div>`;
          }
        }

        // Full markdown report
        if (report.reportMarkdown) {
          html += `<h2>Full Report</h2><div class="report-md">`;
          // Simple markdown to HTML conversion for the report
          const md = (report.reportMarkdown as string)
            .replace(/### (.+)/g, '<h3>$1</h3>')
            .replace(/## (.+)/g, '<h2 style="font-size:16px">$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
          html += `<p>${md}</p></div>`;
        }

        html += `<div class="footer">Generated by Troubadour &mdash; AI-Powered Music Review Platform</div>`;
        html += `</body></html>`;

        return { html, trackName };
      }),
  }),

  // ── Structure Analysis (Feature 7) ──
  structure: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        return db.getStructureAnalysis(input.trackId) ?? null;
      }),

    generate: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "structureAnalysis");
        const track = await db.getTrackById(input.trackId);
        if (!track) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Track needs audio analysis first. Run a review to generate analysis." });
        const analysis = features.geminiAnalysisJson as any;
        const lyricsRow = await db.getLyricsByTrack(input.trackId);
        const result = await generateStructureAnalysis(analysis, track.originalFilename, track.detectedGenre || "Unknown", lyricsRow?.[0]?.text || undefined);
        await db.upsertStructureAnalysis({
          trackId: input.trackId,
          sectionsJson: result.sections,
          structureScore: result.structureScore,
          genreExpectations: result.genreExpectations,
          suggestions: result.suggestions,
        });
        return result;
      }),
  }),

  // ── Genre Benchmarks (Feature 5) ──
  benchmark: router({
    genres: protectedProcedure.query(async () => {
      return db.getAllGenresWithCounts();
    }),

    byGenre: protectedProcedure
      .input(z.object({ genre: z.string() }))
      .query(async ({ input }) => {
        const data = await db.getGenreBenchmarks(input.genre);
        if (!data || data.trackCount === 0) return null;
        const scores = data.reviews
          .map(r => {
            try { return typeof r.scoresJson === "string" ? JSON.parse(r.scoresJson) : r.scoresJson; } catch { return null; }
          })
          .filter((s): s is Record<string, number> => s !== null);
        return aggregateGenreBenchmarks(input.genre, data.trackCount, scores);
      }),
  }),

  // ── Revision Timeline (Feature 2) ──
  timeline: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        return db.getVersionTimeline(input.trackId);
      }),
  }),

  // ── DAW Session Notes Export (Feature 6) ──
  dawExport: router({
    generate: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "dawExport");
        const exportData = await db.getTrackExportData(input.trackId);
        if (!exportData) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Track needs audio analysis first." });
        const analysis = features.geminiAnalysisJson as any;
        const notes = await generateDAWSessionNotes(
          analysis,
          exportData.track.originalFilename,
          exportData.track.detectedGenre || "Unknown",
          exportData.review?.reviewMarkdown,
          exportData.mixReport?.reportMarkdown,
        );
        return notes;
      }),
  }),

  // ── Mood/Energy Curve (Feature 8) — reads from existing Gemini analysis ──
  moodEnergy: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) return null;
        const analysis = features.geminiAnalysisJson as any;
        return {
          energyCurve: analysis.energy?.curve || [],
          overallEnergy: analysis.energy?.overall || "unknown",
          dynamicRange: analysis.energy?.dynamicRange || "unknown",
          mood: analysis.mood || [],
          sections: (analysis.sections || []).map((s: any) => ({
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            energy: s.energy,
            description: s.description,
          })),
          arrangement: analysis.arrangement || {},
        };
      }),
  }),

  // ── Project Insights (Round 40 Feature 1) ──
  insights: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return db.getLatestProjectInsight(input.projectId);
      }),

    generate: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "analytics");

        const allTracks = await db.getTracksByProject(input.projectId);
        const allReviews = await db.getReviewsByProject(input.projectId);
        const reviewedTracks = allTracks.filter(t => t.status === "reviewed");
        if (reviewedTracks.length < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Need at least 2 reviewed tracks to generate insights" });
        }

        const trackData = reviewedTracks.map(track => {
          const review = allReviews.find(r => r.trackId === track.id && r.isLatest && r.reviewType === "track");
          return {
            filename: track.originalFilename,
            genre: track.detectedGenre,
            quickTake: review?.quickTake || null,
            scores: (review?.scoresJson as Record<string, number>) || {},
            reviewExcerpt: review?.reviewMarkdown?.slice(0, 500) || "",
          };
        });

        const result = await generateProjectInsights(project.title, trackData);
        const { id } = await db.createProjectInsight({
          projectId: input.projectId,
          userId: ctx.user.id,
          summaryMarkdown: result.summaryMarkdown,
          strengthsJson: result.strengths,
          weaknessesJson: result.weaknesses,
          recommendationsJson: result.recommendations,
          averageScoresJson: result.averageScores,
          trackCount: reviewedTracks.length,
        });
        return { id, ...result };
      }),
  }),

  // ── Score Matrix (Round 40 Feature 2) ──
  matrix: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return db.getProjectScoreMatrix(input.projectId);
      }),
  }),

  // ── CSV Export (Round 40 Feature 3) ──
  csvExport: router({
    generate: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "export");

        const { rows } = await db.getProjectCsvData(input.projectId);
        if (rows.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No tracks to export" });
        }

        // Collect all score keys
        const allScoreKeys = new Set<string>();
        for (const row of rows) {
          for (const k of Object.keys(row.scores)) allScoreKeys.add(k);
        }
        const scoreKeys = Array.from(allScoreKeys).sort();

        // Build CSV
        const headers = ["Track", "Genre", "Status", "Quick Take", ...scoreKeys.map(k => k.replace(/([A-Z])/g, " $1").trim()), "Review Date"];
        const csvRows = [headers.join(",")];
        for (const row of rows) {
          const values = [
            `"${row.trackName.replace(/"/g, '""')}"`,
            `"${row.genre.replace(/"/g, '""')}"`,
            row.status,
            `"${row.quickTake.replace(/"/g, '""').replace(/\n/g, " ")}"`,
            ...scoreKeys.map(k => row.scores[k]?.toString() || ""),
            row.reviewDate ? new Date(row.reviewDate).toLocaleDateString() : "",
          ];
          csvRows.push(values.join(","));
        }

        return {
          csv: csvRows.join("\n"),
          filename: `${project.title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-scores.csv`,
        };
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
  // ── Review Digest ──
  digest: router({
    get: protectedProcedure
      .input(z.object({
        daysBack: z.number().min(1).max(90).default(7),
      }))
      .query(async ({ ctx, input }) => {
        return db.getDigestData(ctx.user.id, input.daysBack);
      }),

    generateEmail: protectedProcedure
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
  }),

  // ── Sentiment Heatmap ──
  sentimentHeatmap: router({
    generate: protectedProcedure
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
    generate: protectedProcedure
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
          const { generateImage } = await import("./_core/imageGeneration");
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
    generateChecklist: protectedProcedure
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
        const checklist = await db.getMasteringChecklistByTrack(0); // we need to get by id
        // Get checklist by querying with the id
        const dbObj = await (async () => {
          const d = await db.getDb();
          if (!d) return null;
          const { masteringChecklists } = await import("../drizzle/schema");
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

  // ── A/B Review Comparison ──
  abCompare: router({
    generate: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        templateAId: z.number().optional(),
        templateBId: z.number().optional(),
        focusA: z.enum(["songwriter", "producer", "arranger", "artist", "anr", "full"]).default("full"),
        focusB: z.enum(["songwriter", "producer", "arranger", "artist", "anr", "full"]).default("full"),
        reviewLength: z.enum(["brief", "standard", "detailed"]).default("standard"),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

        const batchId = `ab_${nanoid(8)}`;
        const metadataBase = { reviewLength: input.reviewLength };

        // Queue job A
        const metaA: Record<string, any> = { ...metadataBase, reviewFocus: input.focusA, abSide: "A", abBatchId: batchId };
        if (input.templateAId) {
          const tpl = await db.getReviewTemplateById(input.templateAId);
          if (tpl) {
            metaA.templateId = tpl.id;
            metaA.templateFocusAreas = tpl.focusAreas;
            metaA.templateName = tpl.name;
          }
        }
        const jobA = await db.createJob({
          projectId: track.projectId,
          trackId: input.trackId,
          userId: ctx.user.id,
          type: "review",
          batchId,
          metadata: metaA,
        });

        // Queue job B
        const metaB: Record<string, any> = { ...metadataBase, reviewFocus: input.focusB, abSide: "B", abBatchId: batchId };
        if (input.templateBId) {
          const tpl = await db.getReviewTemplateById(input.templateBId);
          if (tpl) {
            metaB.templateId = tpl.id;
            metaB.templateFocusAreas = tpl.focusAreas;
            metaB.templateName = tpl.name;
          }
        }
        const jobB = await db.createJob({
          projectId: track.projectId,
          trackId: input.trackId,
          userId: ctx.user.id,
          type: "review",
          batchId,
          metadata: metaB,
        });

        return { batchId, jobAId: jobA.id, jobBId: jobB.id };
      }),

    getResults: protectedProcedure
      .input(z.object({ batchId: z.string() }))
      .query(async ({ ctx, input }) => {
        const d = await db.getDb();
        if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { jobs: jobsTable, reviews: reviewsTable } = await import("../drizzle/schema");

        const abJobs = await d.select().from(jobsTable)
          .where(and(eq(jobsTable.batchId, input.batchId), eq(jobsTable.userId, ctx.user.id)))
          .orderBy(asc(jobsTable.createdAt));

        if (abJobs.length < 2) return { status: "pending", jobs: abJobs, reviewA: null, reviewB: null };

        const allDone = abJobs.every(j => j.status === "done");
        const anyError = abJobs.some(j => j.status === "error");

        let reviewA = null;
        let reviewB = null;

        if (allDone) {
          for (const j of abJobs) {
            const meta = j.metadata as any;
            if (j.resultId) {
              const revRows = await d.select().from(reviewsTable).where(eq(reviewsTable.id, j.resultId)).limit(1);
              if (meta?.abSide === "A") reviewA = revRows[0] || null;
              else if (meta?.abSide === "B") reviewB = revRows[0] || null;
            }
          }
        }

        return {
          status: anyError ? "error" : allDone ? "complete" : "pending",
          jobs: abJobs,
          reviewA,
          reviewB,
        };
      }),
  }),

  // ── Track Notes / Journal ──
  trackNote: router({
    create: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        content: z.string().min(1).max(10000),
        pinned: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return db.createTrackNote({
          trackId: input.trackId,
          userId: ctx.user.id,
          content: input.content,
          pinned: input.pinned ?? false,
        });
      }),

    list: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listTrackNotes(input.trackId, ctx.user.id);
      }),

    update: protectedProcedure
      .input(z.object({
        noteId: z.number(),
        content: z.string().min(1).max(10000).optional(),
        pinned: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getTrackNoteById(input.noteId);
        if (!note || note.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        const updates: Record<string, any> = {};
        if (input.content !== undefined) updates.content = input.content;
        if (input.pinned !== undefined) updates.pinned = input.pinned;
        await db.updateTrackNote(input.noteId, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getTrackNoteById(input.noteId);
        if (!note || note.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        await db.deleteTrackNote(input.noteId);
        return { success: true };
      }),
  }),

  // ── Portfolio Export (label-ready HTML report) ──
  portfolio: router({
    generate: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "export");

        const data = await db.getPortfolioData(input.projectId);
        if (!data) throw new TRPCError({ code: "NOT_FOUND" });

        const { tracks: allTracks, reviews: allReviews, audioFeatures: allFeatures, artwork, insight } = data;

        // Build track cards
        const markdownToHtml = (md: string) => md
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/^- (.*$)/gim, '<li>$1</li>')
          .replace(/\n\n/gim, '</p><p>')
          .replace(/\n/gim, '<br>');

        let trackCardsHtml = '';
        for (const track of allTracks) {
          const review = allReviews.find(r => r.trackId === track.id && r.reviewType === 'track');
          const features = allFeatures.find(f => f.trackId === track.id);
          if (!review) continue;

          const scores = review.scoresJson as Record<string, number> | undefined;
          let scoresHtml = '';
          if (scores && Object.keys(scores).length > 0) {
            scoresHtml = `<div class="scores-grid">${Object.entries(scores).map(([k, v]) => {
              const pct = (v / 10) * 100;
              const color = v >= 8 ? '#22c55e' : v >= 6 ? '#3b82f6' : v >= 4 ? '#f59e0b' : '#ef4444';
              return `<div class="score-bar-item"><div class="score-bar-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</div><div class="score-bar-track"><div class="score-bar-fill" style="width:${pct}%;background:${color}"></div></div><div class="score-bar-value">${v}/10</div></div>`;
            }).join('')}</div>`;
          }

          const genreBadge = track.detectedGenre ? `<span class="genre-badge">${track.detectedGenre}</span>` : '';
          const subgenreBadge = track.detectedSubgenres ? `<span class="subgenre-badge">${track.detectedSubgenres}</span>` : '';
          const fj = features?.featuresJson as Record<string, any> | null;
          const featureChips = fj ? `<div class="feature-chips">${fj.bpm ? `<span class="chip">BPM: ${fj.bpm}</span>` : ''}${fj.key ? `<span class="chip">Key: ${fj.key}</span>` : ''}${fj.energy != null ? `<span class="chip">Energy: ${fj.energy}/10</span>` : ''}${fj.danceability != null ? `<span class="chip">Dance: ${fj.danceability}/10</span>` : ''}</div>` : '';

          trackCardsHtml += `
            <div class="track-card">
              <div class="track-header">
                <div class="track-number">${track.trackOrder ?? ''}</div>
                <div class="track-info">
                  <h3 class="track-title">${track.originalFilename.replace(/\.[^.]+$/, '')}</h3>
                  <div class="track-badges">${genreBadge}${subgenreBadge}</div>
                </div>
                ${scores?.overall !== undefined ? `<div class="overall-score" style="color:${(scores.overall ?? 0) >= 8 ? '#22c55e' : (scores.overall ?? 0) >= 6 ? '#3b82f6' : (scores.overall ?? 0) >= 4 ? '#f59e0b' : '#ef4444'}">${scores.overall}<span class="score-max">/10</span></div>` : ''}
              </div>
              ${featureChips}
              ${review.quickTake ? `<div class="quick-take">&ldquo;${review.quickTake}&rdquo;</div>` : ''}
              ${scoresHtml}
              <div class="review-excerpt"><p>${markdownToHtml(review.reviewMarkdown.slice(0, 1500))}${review.reviewMarkdown.length > 1500 ? '...' : ''}</p></div>
            </div>`;
        }

        // Album review section
        const albumReview = allReviews.find(r => r.reviewType === 'album');
        let albumHtml = '';
        if (albumReview) {
          albumHtml = `<div class="album-section"><h2 class="section-title">Album Review</h2>${albumReview.quickTake ? `<div class="quick-take">&ldquo;${albumReview.quickTake}&rdquo;</div>` : ''}<div class="review-content"><p>${markdownToHtml(albumReview.reviewMarkdown)}</p></div></div>`;
        }

        // Artwork gallery
        let artworkHtml = '';
        if (artwork.length > 0) {
          artworkHtml = `<div class="artwork-section"><h2 class="section-title">Artwork Concepts</h2><div class="artwork-grid">${artwork.map(a => a.imageUrl ? `<div class="artwork-item"><img src="${a.imageUrl}" alt="${a.moodDescription || 'Artwork concept'}" />${a.visualStyle ? `<p class="artwork-style">${a.visualStyle}</p>` : ''}</div>` : '').join('')}</div></div>`;
        }

        // Insight summary
        let insightHtml = '';
        if (insight) {
          const strengths = (insight.strengthsJson as string[] | null) || [];
          const weaknesses = (insight.weaknessesJson as string[] | null) || [];
          insightHtml = `<div class="insight-section"><h2 class="section-title">AI Project Summary</h2><div class="review-content"><p>${markdownToHtml(insight.summaryMarkdown)}</p></div>${strengths.length > 0 ? `<div class="strengths"><h4>Strengths</h4><ul>${strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}${weaknesses.length > 0 ? `<div class="weaknesses"><h4>Areas for Growth</h4><ul>${weaknesses.map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}</div>`;
        }

        // Stats summary
        const reviewedTracks = allTracks.filter(t => allReviews.some(r => r.trackId === t.id && r.reviewType === 'track'));
        const avgScore = reviewedTracks.length > 0
          ? reviewedTracks.reduce((sum, t) => {
              const r = allReviews.find(rv => rv.trackId === t.id && rv.reviewType === 'track');
              const s = r?.scoresJson as Record<string, number> | undefined;
              return sum + (s?.overall ?? 0);
            }, 0) / reviewedTracks.length
          : 0;

        const coverUrl = project.coverImageUrl || artwork[0]?.imageUrl || '';

        const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${project.title} — Portfolio</title><style>
          :root{--bg:#0a0a14;--surface:#12121f;--border:#1e1e35;--text:#e8e8f0;--muted:#888;--accent:#c8102e;--accent-soft:rgba(200,16,46,0.15)}
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.7}
          .container{max-width:900px;margin:0 auto;padding:40px 24px}
          .hero{text-align:center;padding:60px 0 40px;border-bottom:2px solid var(--border);margin-bottom:40px}
          .hero-cover{width:200px;height:200px;border-radius:12px;object-fit:cover;margin:0 auto 24px;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
          .hero h1{font-size:2.5em;font-weight:800;letter-spacing:-0.02em;margin-bottom:8px}
          .hero .subtitle{color:var(--muted);font-size:1.1em}
          .stats-row{display:flex;justify-content:center;gap:32px;margin-top:24px}
          .stat{text-align:center}
          .stat-value{font-size:1.8em;font-weight:700;color:var(--accent)}
          .stat-label{font-size:0.8em;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em}
          .section-title{font-size:1.4em;font-weight:700;margin:40px 0 20px;padding-bottom:8px;border-bottom:2px solid var(--border)}
          .track-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:20px}
          .track-header{display:flex;align-items:center;gap:16px;margin-bottom:16px}
          .track-number{width:36px;height:36px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9em;flex-shrink:0}
          .track-info{flex:1}
          .track-title{font-size:1.15em;font-weight:600;margin-bottom:4px}
          .track-badges{display:flex;gap:6px;flex-wrap:wrap}
          .genre-badge,.subgenre-badge{font-size:0.75em;padding:2px 10px;border-radius:12px;background:var(--accent-soft);color:var(--accent)}
          .subgenre-badge{background:rgba(59,130,246,0.15);color:#3b82f6}
          .overall-score{font-size:2em;font-weight:800;flex-shrink:0}
          .score-max{font-size:0.4em;color:var(--muted)}
          .feature-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
          .chip{font-size:0.75em;padding:3px 10px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--muted)}
          .quick-take{font-style:italic;color:var(--muted);padding:12px 16px;background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;margin:12px 0;font-size:0.95em}
          .scores-grid{display:grid;grid-template-columns:1fr;gap:8px;margin:16px 0}
          .score-bar-item{display:flex;align-items:center;gap:12px}
          .score-bar-label{width:120px;font-size:0.8em;color:var(--muted);text-align:right;flex-shrink:0}
          .score-bar-track{flex:1;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden}
          .score-bar-fill{height:100%;border-radius:4px;transition:width 0.3s}
          .score-bar-value{width:40px;font-size:0.8em;font-weight:600;flex-shrink:0}
          .review-excerpt{margin-top:16px;font-size:0.9em;color:rgba(232,232,240,0.8)}
          .review-excerpt p{margin-bottom:8px}
          .review-content p{margin-bottom:8px}
          h2,h3{margin-top:16px;margin-bottom:8px}
          blockquote{border-left:3px solid var(--accent);padding-left:12px;color:var(--muted);margin:12px 0}
          li{margin:4px 0;margin-left:20px}
          .album-section,.insight-section{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;margin:24px 0}
          .strengths h4{color:#22c55e;margin:16px 0 8px} .weaknesses h4{color:#f59e0b;margin:16px 0 8px}
          .artwork-section{margin:32px 0}
          .artwork-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
          .artwork-item{border-radius:12px;overflow:hidden;border:1px solid var(--border)}
          .artwork-item img{width:100%;display:block}
          .artwork-style{padding:8px 12px;font-size:0.8em;color:var(--muted);background:var(--surface)}
          footer{text-align:center;padding:40px 0;color:var(--muted);font-size:0.8em;border-top:1px solid var(--border);margin-top:40px}
          @media print{body{background:#fff;color:#1a1a2e} .container{padding:20px} .track-card,.album-section,.insight-section{border-color:#ddd;background:#f8f8fc} .hero{padding:30px 0 20px} :root{--bg:#fff;--surface:#f8f8fc;--border:#e0e0e0;--text:#1a1a2e;--muted:#666}}
          @media(max-width:600px){.stats-row{flex-wrap:wrap;gap:16px} .track-header{flex-wrap:wrap} .artwork-grid{grid-template-columns:1fr}}
        </style></head><body>
          <div class="container">
            <div class="hero">
              ${coverUrl ? `<img class="hero-cover" src="${coverUrl}" alt="${project.title}" />` : ''}
              <h1>${project.title}</h1>
              <p class="subtitle">${project.type === 'album' ? 'Album' : 'Single'} &middot; ${allTracks.length} Track${allTracks.length !== 1 ? 's' : ''} &middot; AI-Reviewed by Troubadour</p>
              <div class="stats-row">
                <div class="stat"><div class="stat-value">${Math.round(avgScore * 10) / 10}</div><div class="stat-label">Avg Score</div></div>
                <div class="stat"><div class="stat-value">${reviewedTracks.length}</div><div class="stat-label">Reviewed</div></div>
                <div class="stat"><div class="stat-value">${allTracks.length}</div><div class="stat-label">Total Tracks</div></div>
              </div>
            </div>
            ${insightHtml}
            <h2 class="section-title">Track Reviews</h2>
            ${trackCardsHtml}
            ${albumHtml}
            ${artworkHtml}
            <footer>Generated by Troubadour AI &middot; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</footer>
          </div>
        </body></html>`;

        return { htmlContent };
      }),
  }),

  // ── Project Completion Score ──
  completion: router({
    getScore: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

        const d = await db.getDb();
        if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const { tracks: tracksTable, reviews: reviewsTable, masteringChecklists: mcTable } = await import("../drizzle/schema");

        const projectTracks = await d.select().from(tracksTable)
          .where(eq(tracksTable.projectId, input.projectId))
          .orderBy(asc(tracksTable.trackOrder));

        if (projectTracks.length === 0) {
          return {
            overallScore: 0,
            trackCount: 0,
            reviewedCount: 0,
            readyCount: 0,
            averageReviewScore: 0,
            averageMasteringReadiness: 0,
            tracks: [],
          };
        }

        const trackDetails = await Promise.all(projectTracks.map(async (t) => {
          // Get latest review
          const latestReviews = await d.select().from(reviewsTable)
            .where(and(
              eq(reviewsTable.trackId, t.id),
              eq(reviewsTable.reviewType, "track"),
              eq(reviewsTable.isLatest, true)
            ))
            .limit(1);
          const latestReview = latestReviews[0] || null;

          // Get mastering checklist
          const checklists = await d.select().from(mcTable)
            .where(eq(mcTable.trackId, t.id))
            .orderBy(desc(mcTable.updatedAt))
            .limit(1);
          const checklist = checklists[0] || null;

          // Parse scores
          let reviewScore = 0;
          if (latestReview?.scoresJson) {
            const scores = latestReview.scoresJson as any;
            reviewScore = scores.overall ?? 0;
          }

          // Parse tags
          let tags: string[] = [];
          try { tags = t.tags ? JSON.parse(t.tags) : []; } catch { tags = []; }
          const isReady = tags.some((tag: string) => tag.toLowerCase().includes("ready") || tag.toLowerCase().includes("done") || tag.toLowerCase().includes("final"));

          // Calculate track completion
          const hasReview = !!latestReview;
          const masteringReadiness = checklist?.overallReadiness ?? 0;

          // Weighted: 40% review score, 30% mastering readiness, 20% has review, 10% tagged ready
          const trackScore = Math.round(
            (reviewScore / 10) * 40 +
            (masteringReadiness / 100) * 30 +
            (hasReview ? 20 : 0) +
            (isReady ? 10 : 0)
          );

          return {
            id: t.id,
            filename: t.originalFilename,
            trackOrder: t.trackOrder,
            status: t.status,
            reviewScore,
            masteringReadiness,
            hasReview,
            isReady,
            trackScore,
            tags,
          };
        }));

        const reviewedCount = trackDetails.filter(t => t.hasReview).length;
        const readyCount = trackDetails.filter(t => t.isReady).length;
        const avgReviewScore = trackDetails.filter(t => t.hasReview).length > 0
          ? trackDetails.filter(t => t.hasReview).reduce((sum, t) => sum + t.reviewScore, 0) / trackDetails.filter(t => t.hasReview).length
          : 0;
        const avgMastering = trackDetails.filter(t => t.masteringReadiness > 0).length > 0
          ? trackDetails.filter(t => t.masteringReadiness > 0).reduce((sum, t) => sum + t.masteringReadiness, 0) / trackDetails.filter(t => t.masteringReadiness > 0).length
          : 0;
        const overallScore = trackDetails.length > 0
          ? Math.round(trackDetails.reduce((sum, t) => sum + t.trackScore, 0) / trackDetails.length)
          : 0;

        return {
          overallScore,
          trackCount: projectTracks.length,
          reviewedCount,
          readyCount,
          averageReviewScore: Math.round(avgReviewScore * 10) / 10,
          averageMasteringReadiness: Math.round(avgMastering),
          tracks: trackDetails,
        };
      }),
  }),
});
export type AppRouter = typeof appRouter;
