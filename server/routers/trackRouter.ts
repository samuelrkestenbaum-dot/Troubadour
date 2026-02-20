import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import * as db from "../db";
import { storagePut } from "../storage";
import { logAuditEvent } from "../utils/auditTrail";
import { recordActivity } from "../services/retentionEngine";
import { validateAudioMagicBytes } from "../utils/audioValidation";

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac",
  "audio/ogg", "audio/flac", "audio/webm",
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

async function assertUsageAllowed(userId: number) {
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

export const trackRouter = router({
  upload: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      filename: z.string(),
      mimeType: z.string(),
      fileSize: z.number(),
      fileBase64: z.string(),
      parentTrackId: z.number().optional(),
      trackOrder: z.number().optional(),
      versionNumber: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      await assertUsageAllowed(ctx.user.id);
      if (!ALLOWED_AUDIO_TYPES.has(input.mimeType.toLowerCase())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported audio format: ${input.mimeType}. Supported: MP3, WAV, M4A, AAC, OGG, FLAC, WebM.` });
      }
      if (input.fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `File too large (${Math.round(input.fileSize / 1024 / 1024)}MB). Maximum: 50MB.` });
      }
      const fileBuffer = Buffer.from(input.fileBase64, "base64");

      // Magic bytes validation — verify actual file content matches claimed audio format
      const { valid, detectedFormat } = validateAudioMagicBytes(fileBuffer);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File content does not match a recognized audio format. The file may be corrupted or not a valid audio file.",
        });
      }
      console.log(`[Upload] Magic bytes validated: ${detectedFormat} for ${input.filename}`);

      const fileKey = `audio/${ctx.user.id}/${input.projectId}/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);
      let trackOrder = input.trackOrder ?? 0;
      const existingTracks = await db.getTracksByProject(input.projectId);
      if (trackOrder === 0) {
        trackOrder = existingTracks.length + 1;
      }
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

      // Record upload activity for streak tracking
      try {
        await recordActivity(ctx.user.id, "upload");
      } catch (e) {
        console.warn("[Streak] Failed to record upload activity:", e);
      }

      logAuditEvent({ userId: ctx.user.id, action: "track.upload", resourceType: "track", resourceId: track.id, metadata: { filename: input.filename, projectId: input.projectId } });
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
});
