/**
 * Job Processor — database-backed persistent queue
 * 
 * Jobs are stored in the DB and processed via polling.
 * On server restart, any "running" jobs are reset to "queued" and re-processed.
 * This eliminates the in-memory queue that lost jobs on restart.
 * 
 * Pipeline:
 * 1. Gemini listens to the audio → extracts features
 * 2. Claude 4.5 writes the critique based on Gemini's analysis
 * 3. Results stored in DB, notifications sent
 */
import * as db from "../db";
import { analyzeAudioWithGemini, compareAudioWithGemini } from "./geminiAudio";
import { generateTrackReview, generateAlbumReview, generateVersionComparison, extractScores, CLAUDE_MODEL } from "./claudeCritic";
import { notifyOwner } from "../_core/notification";
import type { GeminiAudioAnalysis } from "./geminiAudio";

// Heartbeat interval for long-running jobs (every 30s)
const HEARTBEAT_INTERVAL_MS = 30_000;

// ── Persistent Queue State ──

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let processing = false;
const POLL_INTERVAL_MS = 3000; // Check for new jobs every 3 seconds

/**
 * Start the persistent job queue poller.
 * Called once on server startup.
 */
export function startJobQueue() {
  if (pollingInterval) return; // Already running

  console.log("[JobQueue] Starting persistent job queue poller");

  // On startup, recover any jobs that were "running" when the server died
  recoverStaleJobs().then(() => {
    // Start polling
    pollingInterval = setInterval(() => {
      if (!processing) {
        processNextJob();
      }
    }, POLL_INTERVAL_MS);

    // Also process immediately in case there are queued jobs
    processNextJob();
  });
}

/**
 * Stop the job queue poller (for graceful shutdown).
 */
export function stopJobQueue() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[JobQueue] Job queue poller stopped");
  }
}

/**
 * Enqueue a job — simply marks it as queued in the DB.
 * The poller will pick it up automatically.
 * This function exists for backward compatibility with the router.
 */
export function enqueueJob(jobId: number) {
  // The job is already created with status "queued" in the DB.
  // The poller will pick it up. But trigger an immediate check.
  if (!processing) {
    processNextJob();
  }
}

/**
 * Recover jobs that were "running" when the server crashed/restarted.
 * Resets them to "queued" so they get re-processed.
 */
async function recoverStaleJobs() {
  try {
    const staleJobs = await db.getStaleRunningJobs();
    if (staleJobs.length > 0) {
      console.log(`[JobQueue] Recovering ${staleJobs.length} stale running job(s)...`);
      for (const job of staleJobs) {
        await db.updateJob(job.id, {
          status: "queued",
          progress: 0,
          progressMessage: "Recovered after server restart — retrying...",
        });
        // Reset track status if needed
        if (job.trackId) {
          const track = await db.getTrackById(job.trackId);
          if (track) {
            if (job.type === "analyze" && track.status === "analyzing") {
              await db.updateTrackStatus(track.id, "uploaded");
            } else if (job.type === "review" && track.status === "reviewing") {
              await db.updateTrackStatus(track.id, "analyzed");
            }
          }
        }
      }
      console.log(`[JobQueue] Recovered ${staleJobs.length} job(s)`);
    }
  } catch (error) {
    console.error("[JobQueue] Failed to recover stale jobs:", error);
  }
}

/**
 * Pick the next queued job from the DB and process it.
 * Uses atomic claiming to prevent race conditions.
 */
async function processNextJob() {
  if (processing) return;

  try {
    // Atomic claim: only one instance can claim a job
    const claimedJob = await db.claimNextQueuedJob();
    if (!claimedJob) return; // No jobs to process

    processing = true;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    try {
      const job = claimedJob;

      // Start heartbeat to signal we're still alive
      heartbeatTimer = setInterval(async () => {
        try {
          await db.updateJobHeartbeat(job.id);
        } catch (e) {
          console.warn(`[JobQueue] Heartbeat update failed for job ${job.id}:`, e);
        }
      }, HEARTBEAT_INTERVAL_MS);

      switch (job.type) {
        case "analyze":
          await processAnalyzeJob(job.id, job);
          break;
        case "review":
          await processReviewJob(job.id, job);
          break;
        case "album_review":
          await processAlbumReviewJob(job.id, job);
          break;
        case "compare":
          await processCompareJob(job.id, job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (error: any) {
      console.error(`[JobQueue] Job ${claimedJob.id} failed (attempt ${claimedJob.attempts}):`, error);
      const rawMessage = error.message || "Unknown error";
      const errorMessage = rawMessage.length > 2000
        ? rawMessage.substring(0, 2000) + "... (truncated)"
        : rawMessage;

      // If we have retries left, re-queue instead of failing permanently
      const maxAttempts = claimedJob.maxAttempts || 3;
      if (claimedJob.attempts < maxAttempts) {
        console.log(`[JobQueue] Re-queuing job ${claimedJob.id} (attempt ${claimedJob.attempts}/${maxAttempts})`);
        try {
          await db.updateJob(claimedJob.id, {
            status: "queued",
            progressMessage: `Retry ${claimedJob.attempts}/${maxAttempts}: ${errorMessage.substring(0, 200)}`,
          });
          // Reset track status for retry
          if (claimedJob.trackId) {
            const track = await db.getTrackById(claimedJob.trackId);
            if (track) {
              if (claimedJob.type === "analyze" && track.status === "analyzing") {
                await db.updateTrackStatus(track.id, "uploaded");
              } else if (claimedJob.type === "review" && track.status === "reviewing") {
                await db.updateTrackStatus(track.id, "analyzed");
              }
            }
          }
        } catch (requeueError) {
          console.error(`[JobQueue] Failed to re-queue job ${claimedJob.id}:`, requeueError);
          await db.updateJob(claimedJob.id, { status: "error", errorMessage, completedAt: new Date() }).catch(() => {});
        }
      } else {
        try {
          await db.updateJob(claimedJob.id, {
            status: "error",
            errorMessage: `Failed after ${maxAttempts} attempts. Last error: ${errorMessage}`,
            completedAt: new Date(),
          });
        } catch (updateError) {
          console.error(`[JobQueue] Failed to update job ${claimedJob.id} error status:`, updateError);
          await db.updateJob(claimedJob.id, {
            status: "error",
            errorMessage: "Job failed — see server logs for details",
            completedAt: new Date(),
          }).catch(() => {});
        }
      }
    } finally {
      // Always clear heartbeat timer
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    }

    processing = false;

    // Check if this job was part of a batch and if the batch is now complete
    if (claimedJob.batchId) {
      await checkBatchCompletion(claimedJob.batchId, claimedJob.projectId);
    }

    // Immediately check for more jobs
    processNextJob();
  } catch (error) {
    console.error("[JobQueue] Error in processNextJob:", error);
    processing = false;
  }
}

/**
 * Check if all jobs in a batch are complete and send a summary notification.
 */
async function checkBatchCompletion(batchId: string, projectId: number) {
  try {
    const batchJobs = await db.getJobsByBatchId(batchId);
    if (batchJobs.length === 0) return;

    // Check if all jobs are terminal (done or error)
    const allTerminal = batchJobs.every(j => j.status === "done" || j.status === "error");
    if (!allTerminal) return;

    // Check if we already sent a batch notification (avoid duplicates)
    // We use the first job's notificationSent as a proxy for batch notification
    const reviewJobs = batchJobs.filter(j => j.type === "review");
    const alreadyNotified = reviewJobs.some(j => j.progressMessage?.includes("[batch-notified]"));
    if (alreadyNotified) return;

    // Gather batch summary
    const succeeded = reviewJobs.filter(j => j.status === "done").length;
    const failed = reviewJobs.filter(j => j.status === "error").length;
    const total = reviewJobs.length;

    const project = await db.getProjectById(projectId);
    const projectTitle = project?.title || `Project #${projectId}`;

    // Send batch completion notification
    await notifyOwner({
      title: `Batch Review Complete: ${projectTitle}`,
      content: `All ${total} track review(s) for "${projectTitle}" have finished processing. ${succeeded} succeeded${failed > 0 ? `, ${failed} failed` : ""}. Your reviews are ready to view.`,
    });

    // Mark batch as notified to prevent duplicate notifications
    for (const job of reviewJobs) {
      await db.updateJob(job.id, {
        progressMessage: (job.progressMessage || "") + " [batch-notified]",
      });
    }

    console.log(`[JobQueue] Batch ${batchId} complete: ${succeeded}/${total} succeeded`);
  } catch (error) {
    console.warn("[JobQueue] Batch completion check failed:", error);
  }
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

  // Save detected genre to the track for easy access
  if (geminiAnalysis.genre) {
    await db.updateTrackGenre(
      track.id,
      geminiAnalysis.genre.primary || "Unknown",
      geminiAnalysis.genre.secondary || [],
      geminiAnalysis.genre.influences || [],
    );
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
    console.warn("[JobQueue] Notification failed:", e);
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

  // Extract template focus areas from job metadata (if user selected a template)
  const jobMetadata = job.metadata as { templateId?: number; focusAreas?: string[] } | null;
  const templateFocusAreas = jobMetadata?.focusAreas;
  if (templateFocusAreas?.length) {
    console.log(`[JobQueue] Using template focus areas: ${templateFocusAreas.join(", ")}`);
  }

  await db.updateJob(jobId, { progress: 20, progressMessage: "Checking for previous reviews..." });

  // Smart re-review: look for the current latest review on this track
  const existingReviews = await db.getReviewHistory(track.id);
  const latestExisting = existingReviews.length > 0 ? existingReviews[0] : null;
  let previousReviewContext: {
    reviewMarkdown: string;
    scores: Record<string, number>;
    quickTake?: string;
    reviewVersion: number;
    createdAt: Date;
  } | undefined;

  if (latestExisting) {
    // Fetch the full review to get the markdown
    const fullPrevReview = await db.getReviewById(latestExisting.id);
    if (fullPrevReview) {
      previousReviewContext = {
        reviewMarkdown: fullPrevReview.reviewMarkdown,
        scores: (latestExisting.scoresJson as Record<string, number>) || {},
        quickTake: latestExisting.quickTake || undefined,
        reviewVersion: latestExisting.reviewVersion ?? 1,
        createdAt: latestExisting.createdAt,
      };
      console.log(`[JobQueue] Smart re-review: passing v${previousReviewContext.reviewVersion} context to Claude`);
    }
  }

  await db.updateJob(jobId, { progress: 30, progressMessage: previousReviewContext ? "Writing follow-up critique..." : "Writing your critique..." });

  // Use auto-detected genre from Gemini analysis, falling back to user-provided genre
  const geminiAnalysis = features.geminiAnalysisJson as GeminiAudioAnalysis;
  const detectedGenre = geminiAnalysis.genre;
  const genreContext = detectedGenre
    ? `${detectedGenre.primary}${detectedGenre.secondary?.length ? ` / ${detectedGenre.secondary.join(", ")}` : ""}${detectedGenre.influences?.length ? ` (influences: ${detectedGenre.influences.join(", ")})` : ""}`
    : project.genre || undefined;

  // Step: Claude generates the review (guided by reviewFocus, template focus areas, detected genre, and previous review)
  const reviewResult = await generateTrackReview({
    trackTitle: track.originalFilename.replace(/\.[^.]+$/, ""),
    projectTitle: project.title,
    audioAnalysis: geminiAnalysis,
    lyrics: lyricsText,
    intentNotes: project.intentNotes || undefined,
    genre: genreContext,
    referenceArtists: project.referenceArtists || undefined,
    reviewFocus,
    previousReview: previousReviewContext,
    templateFocusAreas,
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
  await db.incrementMonthlyReviewCount(job.userId);
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
    console.warn("[JobQueue] Notification failed:", e);
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
  await db.incrementMonthlyReviewCount(job.userId);
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
    console.warn("[JobQueue] Notification failed:", e);
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
    console.warn("[JobQueue] Gemini comparison failed, proceeding with analysis data only:", e.message);
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

  await db.incrementMonthlyReviewCount(job.userId);
  await db.updateJob(jobId, {
    status: "done",
    progress: 100,
    progressMessage: "Version comparison complete",
    resultId: review.id,
    completedAt: new Date(),
  });

  try {
    await notifyOwner({
      title: `Version Comparison Ready: ${v2Track.originalFilename}`,
      content: `Comparison between v${v1Track.versionNumber} and v${v2Track.versionNumber} of "${v2Track.originalFilename}" is complete.`,
    });
    await db.updateJob(jobId, { notificationSent: true });
  } catch (e) {
    console.warn("[JobQueue] Notification failed:", e);
  }
}
