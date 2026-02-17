import { enqueueJob } from "../services/jobProcessor";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, aiReviewProcedure } from "../_core/trpc";
import * as db from "../db";
import { assertUsageAllowed, assertMonthlyReviewAllowed, assertFeatureAllowed } from "../guards";

export const jobRouter = router({
  analyze: aiReviewProcedure
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

  review: aiReviewProcedure
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

  reReview: aiReviewProcedure
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

  albumReview: aiReviewProcedure
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

  compare: aiReviewProcedure
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

  retry: aiReviewProcedure
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

  analyzeAndReview: aiReviewProcedure
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

  batchReviewAll: aiReviewProcedure
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

  batchReReview: aiReviewProcedure
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
});
