/**
 * Job Processor — orchestrates the async pipeline:
 * 1. Gemini listens to the audio → extracts features
 * 2. Claude 4.5 writes the critique based on Gemini's analysis
 * 3. Results stored in DB, notifications sent
 */
import * as db from "../db";
import { analyzeAudioWithGemini, compareAudioWithGemini } from "./geminiAudio";
import { generateTrackReview, generateAlbumReview, generateVersionComparison, extractScores, CLAUDE_MODEL } from "./claudeCritic";
import { notifyOwner } from "../_core/notification";
import type { GeminiAudioAnalysis } from "./geminiAudio";

// Simple in-memory queue — processes jobs sequentially
const jobQueue: number[] = [];
let processing = false;

export function enqueueJob(jobId: number) {
  jobQueue.push(jobId);
  if (!processing) {
    processNextJob();
  }
}

async function processNextJob() {
  if (jobQueue.length === 0) {
    processing = false;
    return;
  }

  processing = true;
  const jobId = jobQueue.shift()!;

  try {
    const job = await db.getJobById(jobId);
    if (!job || job.status === "done" || job.status === "error") {
      processNextJob();
      return;
    }

    await db.updateJob(jobId, { status: "running", progress: 5, progressMessage: "Starting..." });

    switch (job.type) {
      case "analyze":
        await processAnalyzeJob(jobId, job);
        break;
      case "review":
        await processReviewJob(jobId, job);
        break;
      case "album_review":
        await processAlbumReviewJob(jobId, job);
        break;
      case "compare":
        await processCompareJob(jobId, job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  } catch (error: any) {
    console.error(`[JobProcessor] Job ${jobId} failed:`, error);
    await db.updateJob(jobId, {
      status: "error",
      errorMessage: error.message || "Unknown error",
      completedAt: new Date(),
    });
  }

  // Process next job
  processNextJob();
}

// ── Analyze Job: Gemini listens to the audio ──

async function processAnalyzeJob(jobId: number, job: any) {
  if (!job.trackId) throw new Error("Analyze job requires a trackId");

  const track = await db.getTrackById(job.trackId);
  if (!track) throw new Error(`Track ${job.trackId} not found`);

  await db.updateTrackStatus(track.id, "analyzing");
  await db.updateJob(jobId, { progress: 10, progressMessage: "Sending audio for analysis..." });

  // Get project to check reviewFocus
  const project = await db.getProjectById(track.projectId);
  const reviewFocus = (project?.reviewFocus as any) || "full";

  // Step 1: Gemini analyzes the audio (guided by reviewFocus)
  const geminiAnalysis = await analyzeAudioWithGemini(track.storageUrl, track.mimeType, reviewFocus);

  await db.updateJob(jobId, { progress: 60, progressMessage: "Audio analysis complete. Saving features..." });

  // Step 2: Save features to DB
  const duration = geminiAnalysis.estimatedDuration || track.duration || 0;
  await db.saveAudioFeatures({
    trackId: track.id,
    featuresJson: {
      tempo: geminiAnalysis.tempo,
      key: geminiAnalysis.key,
      instrumentation: geminiAnalysis.instrumentation,
      mood: geminiAnalysis.mood,
      genre: geminiAnalysis.genre,
    },
    energyCurveJson: geminiAnalysis.energy,
    sectionsJson: geminiAnalysis.sections,
    geminiAnalysisJson: geminiAnalysis as any,
  });

  // Update track duration if we got it from Gemini
  if (duration > 0 && !track.duration) {
    const dbInstance = await db.getDb();
    if (dbInstance) {
      const { tracks } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.update(tracks).set({ duration }).where(eq(tracks.id, track.id));
    }
  }

  // Update audio minutes used
  const minutes = Math.ceil(duration / 60);
  await db.incrementAudioMinutes(job.userId, minutes);

  await db.updateTrackStatus(track.id, "analyzed");
  await db.updateJob(jobId, {
    status: "done",
    progress: 100,
    progressMessage: "Audio analysis complete",
    completedAt: new Date(),
  });

  // Send notification
  try {
    await notifyOwner({
      title: `Audio Analysis Complete: ${track.originalFilename}`,
      content: `Audio analysis complete for "${track.originalFilename}". Key: ${geminiAnalysis.key.estimated}, Tempo: ${geminiAnalysis.tempo.bpm} BPM, Genre: ${geminiAnalysis.genre.primary}. The track is ready for review.`,
    });
    await db.updateJob(jobId, { notificationSent: true });
  } catch (e) {
    console.warn("[JobProcessor] Notification failed:", e);
  }
}

// ── Review Job: Claude writes the critique ──

async function processReviewJob(jobId: number, job: any) {
  if (!job.trackId) throw new Error("Review job requires a trackId");

  const track = await db.getTrackById(job.trackId);
  if (!track) throw new Error(`Track ${job.trackId} not found`);

  const project = await db.getProjectById(track.projectId);
  if (!project) throw new Error(`Project ${track.projectId} not found`);

  await db.updateTrackStatus(track.id, "reviewing");
  await db.updateJob(jobId, { progress: 10, progressMessage: "Preparing review data..." });

  // Get audio features
  const features = await db.getAudioFeaturesByTrack(track.id);
  if (!features?.geminiAnalysisJson) {
    throw new Error("No audio analysis found. Please analyze the track first.");
  }

  // Get lyrics if available
  const trackLyrics = await db.getLyricsByTrack(track.id);
  const lyricsText = trackLyrics.length > 0 ? trackLyrics[0].text : undefined;

  const reviewFocus = (project.reviewFocus as any) || "full";
  await db.updateJob(jobId, { progress: 30, progressMessage: "Writing your critique..." });

  // Step: Claude generates the review (guided by reviewFocus)
  const reviewResult = await generateTrackReview({
    trackTitle: track.originalFilename.replace(/\.[^.]+$/, ""),
    projectTitle: project.title,
    audioAnalysis: features.geminiAnalysisJson as GeminiAudioAnalysis,
    lyrics: lyricsText,
    intentNotes: project.intentNotes || undefined,
    genre: project.genre || undefined,
    referenceArtists: project.referenceArtists || undefined,
    reviewFocus,
  });

  await db.updateJob(jobId, { progress: 80, progressMessage: "Saving review..." });

  // Save review
  const review = await db.createReview({
    projectId: project.id,
    trackId: track.id,
    userId: job.userId,
    reviewType: "track",
    modelUsed: CLAUDE_MODEL,
    reviewMarkdown: reviewResult.reviewMarkdown,
    scoresJson: reviewResult.scores,
    quickTake: reviewResult.quickTake,
  });

  await db.updateTrackStatus(track.id, "reviewed");
  await db.updateJob(jobId, {
    status: "done",
    progress: 100,
    progressMessage: "Review complete",
    resultId: review.id,
    completedAt: new Date(),
  });

  // Send notification
  try {
    await notifyOwner({
      title: `Track Review Ready: ${track.originalFilename}`,
      content: `Critique complete for "${track.originalFilename}". Overall score: ${reviewResult.scores.overall || "N/A"}/10. Your detailed review is ready to view.`,
    });
    await db.updateJob(jobId, { notificationSent: true });
  } catch (e) {
    console.warn("[JobProcessor] Notification failed:", e);
  }
}

// ── Album Review Job ──

async function processAlbumReviewJob(jobId: number, job: any) {
  const project = await db.getProjectById(job.projectId);
  if (!project) throw new Error(`Project ${job.projectId} not found`);

  await db.updateProjectStatus(project.id, "processing");
  await db.updateJob(jobId, { progress: 10, progressMessage: "Gathering track data for album review..." });

  const projectTracks = await db.getTracksByProject(project.id);
  if (projectTracks.length === 0) throw new Error("No tracks found in project");

  // Gather all track reviews and analyses
  const trackReviews = [];
  for (const track of projectTracks) {
    const features = await db.getAudioFeaturesByTrack(track.id);
    const reviews = await db.getReviewsByTrack(track.id);
    const trackLyrics = await db.getLyricsByTrack(track.id);
    const latestReview = reviews.length > 0 ? reviews[0] : null;

    if (features?.geminiAnalysisJson) {
      trackReviews.push({
        trackTitle: track.originalFilename.replace(/\.[^.]+$/, ""),
        trackOrder: track.trackOrder,
        audioAnalysis: features.geminiAnalysisJson as GeminiAudioAnalysis,
        reviewMarkdown: latestReview?.reviewMarkdown || "No individual review available",
        scores: (latestReview?.scoresJson as Record<string, number>) || {},
        lyrics: trackLyrics.length > 0 ? trackLyrics[0].text : undefined,
      });
    }
  }

  if (trackReviews.length === 0) {
    throw new Error("No analyzed tracks found. Please analyze individual tracks first.");
  }

  await db.updateJob(jobId, { progress: 40, progressMessage: "Writing the album A&R memo..." });

  const albumResult = await generateAlbumReview({
    projectTitle: project.title,
    albumConcept: project.albumConcept || undefined,
    targetVibe: project.targetVibe || undefined,
    genre: project.genre || undefined,
    referenceArtists: project.referenceArtists || undefined,
    intentNotes: project.intentNotes || undefined,
    trackReviews,
  });

  await db.updateJob(jobId, { progress: 80, progressMessage: "Saving album review..." });

  const review = await db.createReview({
    projectId: project.id,
    trackId: null,
    userId: job.userId,
    reviewType: "album",
    modelUsed: CLAUDE_MODEL,
    reviewMarkdown: albumResult.reviewMarkdown,
    scoresJson: albumResult.scores,
    quickTake: null,
  });

  await db.updateProjectStatus(project.id, "reviewed");
  await db.updateJob(jobId, {
    status: "done",
    progress: 100,
    progressMessage: "Album review complete",
    resultId: review.id,
    completedAt: new Date(),
  });

  try {
    await notifyOwner({
      title: `Album Review Ready: ${project.title}`,
      content: `The full album A&R memo for "${project.title}" (${trackReviews.length} tracks) is complete. Your album-level analysis, sequencing recommendations, and singles picks are ready.`,
    });
    await db.updateJob(jobId, { notificationSent: true });
  } catch (e) {
    console.warn("[JobProcessor] Notification failed:", e);
  }
}

// ── Compare Job ──

async function processCompareJob(jobId: number, job: any) {
  if (!job.trackId) throw new Error("Compare job requires a trackId (v2)");

  const v2Track = await db.getTrackById(job.trackId);
  if (!v2Track) throw new Error(`Track ${job.trackId} not found`);
  if (!v2Track.parentTrackId) throw new Error("Track has no parent version to compare against");

  const v1Track = await db.getTrackById(v2Track.parentTrackId);
  if (!v1Track) throw new Error(`Parent track ${v2Track.parentTrackId} not found`);

  await db.updateJob(jobId, { progress: 10, progressMessage: "Gathering version data..." });

  const v1Features = await db.getAudioFeaturesByTrack(v1Track.id);
  const v2Features = await db.getAudioFeaturesByTrack(v2Track.id);

  if (!v1Features?.geminiAnalysisJson || !v2Features?.geminiAnalysisJson) {
    throw new Error("Both versions must be analyzed before comparison");
  }

  await db.updateJob(jobId, { progress: 20, progressMessage: "Comparing both versions..." });

  // Gemini side-by-side comparison
  let geminiComparison = "";
  try {
    geminiComparison = await compareAudioWithGemini(
      v1Track.storageUrl, v1Track.mimeType,
      v2Track.storageUrl, v2Track.mimeType
    );
  } catch (e: any) {
    console.warn("[JobProcessor] Gemini comparison failed, proceeding with analysis data only:", e.message);
  }

  await db.updateJob(jobId, { progress: 50, progressMessage: "Writing the comparison..." });

  const v1Reviews = await db.getReviewsByTrack(v1Track.id);
  const v2Reviews = await db.getReviewsByTrack(v2Track.id);

  const comparisonMarkdown = await generateVersionComparison({
    trackTitle: v2Track.originalFilename.replace(/\.[^.]+$/, ""),
    v1Analysis: v1Features.geminiAnalysisJson as GeminiAudioAnalysis,
    v2Analysis: v2Features.geminiAnalysisJson as GeminiAudioAnalysis,
    v1Review: v1Reviews[0]?.reviewMarkdown,
    v2Review: v2Reviews[0]?.reviewMarkdown,
    geminiComparison,
  });

  const comparisonScores = extractScores(comparisonMarkdown);

  const review = await db.createReview({
    projectId: v2Track.projectId,
    trackId: v2Track.id,
    userId: job.userId,
    reviewType: "comparison",
    modelUsed: CLAUDE_MODEL,
    reviewMarkdown: comparisonMarkdown,
    scoresJson: comparisonScores,
    quickTake: null,
    comparedTrackId: v1Track.id,
  });

  await db.updateJob(jobId, {
    status: "done",
    progress: 100,
    progressMessage: "Version comparison complete",
    resultId: review.id,
    completedAt: new Date(),
  });

  try {
    await notifyOwner({
      title: `Version Comparison Ready`,
      content: `The comparison between v${v1Track.versionNumber} and v${v2Track.versionNumber} of "${v2Track.originalFilename}" is complete. See what improved and what still needs work.`,
    });
    await db.updateJob(jobId, { notificationSent: true });
  } catch (e) {
    console.warn("[JobProcessor] Notification failed:", e);
  }
}
