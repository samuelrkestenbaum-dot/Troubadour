import { eq, and, desc, asc, sql, count, avg, isNull, inArray, gte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, tracks, lyrics, audioFeatures, reviews, jobs, conversationMessages, referenceTracks, chatSessions, chatMessages, processedWebhookEvents, favorites, reviewTemplates, projectCollaborators, waveformAnnotations, mixReports, structureAnalyses, projectInsights, notifications, reviewComments, artworkConcepts, masteringChecklists, trackNotes, actionModeCache, adminAuditLog, adminSettings } from "../drizzle/schema";
import type { InsertProject, InsertTrack, InsertLyrics, InsertAudioFeatures, InsertReview, InsertJob, InsertConversationMessage, InsertReferenceTrack, InsertChatSession, InsertChatMessage, InsertReviewTemplate, InsertProjectCollaborator, InsertWaveformAnnotation, InsertMixReport, InsertStructureAnalysis, InsertProjectInsight, InsertNotification, InsertReviewComment, InsertArtworkConcept, InsertMasteringChecklist, InsertTrackNote, InsertAdminAuditLog, InsertAdminSetting } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(and(eq(users.openId, openId), isNull(users.deletedAt))).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserSubscription(userId: number, data: {
  tier: "free" | "artist" | "pro";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  audioMinutesLimit?: number;
}) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, any> = { tier: data.tier };
  if (data.stripeCustomerId !== undefined) updateData.stripeCustomerId = data.stripeCustomerId;
  if (data.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = data.stripeSubscriptionId;
  if (data.audioMinutesLimit !== undefined) updateData.audioMinutesLimit = data.audioMinutesLimit;
  await db.update(users).set(updateData).where(eq(users.id, userId));
}

export async function getUserByStripeCustomerId(customerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementAudioMinutes(userId: number, minutes: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ audioMinutesUsed: sql`${users.audioMinutesUsed} + ${minutes}` }).where(eq(users.id, userId));
}

// ── Project helpers ──

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(data);
  return { id: result[0].insertId };
}

export async function getProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateProjectStatus(id: number, status: "draft" | "processing" | "reviewed" | "error") {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ status }).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) return;
  // FK ON DELETE CASCADE handles all child rows (tracks, reviews, jobs, etc.)
  await db.delete(projects).where(eq(projects.id, id));
}

export async function deleteTrack(id: number) {
  const db = await getDb();
  if (!db) return;
  // FK ON DELETE CASCADE handles child rows (reviews, lyrics, audioFeatures, jobs, annotations, etc.)
  await db.delete(tracks).where(eq(tracks.id, id));
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set(data).where(eq(projects.id, id));
}

// ── Track helpers ──

export async function createTrack(data: InsertTrack) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tracks).values(data);
  return { id: result[0].insertId };
}

export async function getTrackCountsByProjects(projectIds: number[]) {
  if (projectIds.length === 0) return new Map<number, { total: number; reviewed: number; processing: number }>();
  const db = await getDb();
  if (!db) return new Map();
  const allTracks = await db.select({
    projectId: tracks.projectId,
    status: tracks.status,
  }).from(tracks).where(inArray(tracks.projectId, projectIds));
  const result = new Map<number, { total: number; reviewed: number; processing: number }>();
  for (const t of allTracks) {
    if (!result.has(t.projectId)) result.set(t.projectId, { total: 0, reviewed: 0, processing: 0 });
    const c = result.get(t.projectId)!;
    c.total++;
    if (t.status === "reviewed") c.reviewed++;
    if (t.status === "analyzing" || t.status === "reviewing") c.processing++;
  }
  return result;
}

export async function getTracksByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tracks).where(eq(tracks.projectId, projectId)).orderBy(asc(tracks.trackOrder));
}

export async function getTrackById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTrackStatus(id: number, status: "uploaded" | "analyzing" | "analyzed" | "reviewing" | "reviewed" | "error") {
  const db = await getDb();
  if (!db) return;
  await db.update(tracks).set({ status }).where(eq(tracks.id, id));
}

export async function updateTrackGenre(id: number, detectedGenre: string, detectedSubgenres: string[], detectedInfluences: string[]) {
  const db = await getDb();
  if (!db) return;
  await db.update(tracks).set({
    detectedGenre,
    detectedSubgenres: detectedSubgenres.join(", "),
    detectedInfluences: detectedInfluences.join(", "),
  }).where(eq(tracks.id, id));
}

export async function getTracksByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tracks).where(eq(tracks.userId, userId));
}

export async function getTrackVersions(parentTrackId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tracks).where(eq(tracks.parentTrackId, parentTrackId)).orderBy(asc(tracks.versionNumber));
}

// ── Dashboard Analytics helpers ──

export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Total projects
  const projectCount = await db.select({ count: count() }).from(projects).where(eq(projects.userId, userId));
  // Total tracks
  const trackCount = await db.select({ count: count() }).from(tracks).where(eq(tracks.userId, userId));
  // Total reviews
  const reviewCount = await db.select({ count: count() }).from(reviews).where(eq(reviews.userId, userId));
  // Reviewed tracks
  const reviewedTrackCount = await db.select({ count: count() }).from(tracks).where(and(eq(tracks.userId, userId), eq(tracks.status, "reviewed")));

  return {
    totalProjects: projectCount[0]?.count ?? 0,
    totalTracks: trackCount[0]?.count ?? 0,
    totalReviews: reviewCount[0]?.count ?? 0,
    reviewedTracks: reviewedTrackCount[0]?.count ?? 0,
  };
}

export async function getScoreDistribution(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const allReviews = await db.select({
    scoresJson: reviews.scoresJson,
  }).from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.reviewType, "track")));

  // Build distribution buckets 1-10
  const distribution: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) distribution[i] = 0;

  for (const r of allReviews) {
    const scores = r.scoresJson as Record<string, number> | null;
    const overall = scores?.overall ?? scores?.Overall;
    if (overall !== undefined && overall !== null) {
      const bucket = Math.max(1, Math.min(10, Math.round(overall)));
      distribution[bucket]++;
    }
  }

  return Object.entries(distribution).map(([score, count]) => ({
    score: parseInt(score),
    count,
  }));
}

export async function getRecentActivity(userId: number, limit = 15) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: reviews.id,
    reviewType: reviews.reviewType,
    quickTake: reviews.quickTake,
    scoresJson: reviews.scoresJson,
    trackId: reviews.trackId,
    projectId: reviews.projectId,
    createdAt: reviews.createdAt,
    reviewVersion: reviews.reviewVersion,
    trackFilename: tracks.filename,
  }).from(reviews).leftJoin(tracks, eq(reviews.trackId, tracks.id)).where(eq(reviews.userId, userId)).orderBy(desc(reviews.createdAt)).limit(limit);
}

export async function getAverageScores(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const allReviews = await db.select({
    scoresJson: reviews.scoresJson,
  }).from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.reviewType, "track")));

  if (allReviews.length === 0) return null;

  const totals: Record<string, { sum: number; count: number }> = {};
  for (const r of allReviews) {
    const scores = r.scoresJson as Record<string, number> | null;
    if (!scores) continue;
    for (const [key, val] of Object.entries(scores)) {
      if (typeof val !== "number") continue;
      if (!totals[key]) totals[key] = { sum: 0, count: 0 };
      totals[key].sum += val;
      totals[key].count++;
    }
  }

  const averages: Record<string, number> = {};
  for (const [key, { sum, count }] of Object.entries(totals)) {
    averages[key] = Math.round((sum / count) * 10) / 10;
  }
  return averages;
}

export async function getTopTracks(userId: number, limit = 5) {
  const db = await getDb();
  if (!db) return [];
  const allReviews = await db.select({
    trackId: reviews.trackId,
    scoresJson: reviews.scoresJson,
    quickTake: reviews.quickTake,
    reviewVersion: reviews.reviewVersion,
  }).from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.reviewType, "track"))).orderBy(desc(reviews.createdAt));

  // Get the latest review per track and sort by overall score
  const trackMap = new Map<number, { trackId: number; overall: number; quickTake: string | null; reviewVersion: number | null }>();
  for (const r of allReviews) {
    if (!r.trackId || trackMap.has(r.trackId)) continue;
    const scores = r.scoresJson as Record<string, number> | null;
    const overall = scores?.overall ?? scores?.Overall;
    if (overall !== undefined) {
      trackMap.set(r.trackId, { trackId: r.trackId, overall, quickTake: r.quickTake, reviewVersion: r.reviewVersion });
    }
  }

  const sorted = Array.from(trackMap.values()).sort((a, b) => b.overall - a.overall).slice(0, limit);

  // Enrich with track names
  const enriched = [];
  for (const item of sorted) {
    const track = await getTrackById(item.trackId);
    enriched.push({
      ...item,
      filename: track?.originalFilename ?? "Unknown",
      genre: track?.detectedGenre ?? null,
    });
  }
  return enriched;
}

export async function getTopGenre(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const allTracks = await db.select({ genre: tracks.detectedGenre }).from(tracks)
    .where(eq(tracks.userId, userId));
  const genreCounts = new Map<string, number>();
  for (const t of allTracks) {
    if (t.genre) {
      genreCounts.set(t.genre, (genreCounts.get(t.genre) || 0) + 1);
    }
  }
  if (genreCounts.size === 0) return null;
  let topGenre = "";
  let maxCount = 0;
  for (const [genre, cnt] of Array.from(genreCounts.entries())) {
    if (cnt > maxCount) { topGenre = genre; maxCount = cnt; }
  }
  return topGenre;
}

// ── Track Tags helpers ──

export async function updateTrackTags(trackId: number, tags: string[]) {
  const db = await getDb();
  if (!db) return;
  await db.update(tracks).set({ tags: tags.join(",") }).where(eq(tracks.id, trackId));
}

export async function getTrackTags(trackId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ tags: tracks.tags }).from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (result.length === 0 || !result[0].tags) return [];
  return result[0].tags.split(",").filter(Boolean).map(t => t.trim());
}

// ── Lyrics helpers ──

export async function upsertLyrics(trackId: number, lyricsText: string, source: "user" | "transcribed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Atomic upsert using unique index on (trackId, source) — no race condition
  const result = await db.insert(lyrics).values({ trackId, text: lyricsText, source })
    .onDuplicateKeyUpdate({ set: { text: lyricsText } });
  // onDuplicateKeyUpdate returns insertId=0 on update, so look up the row if needed
  if (result[0].insertId) return { id: result[0].insertId };
  const existing = await db.select({ id: lyrics.id }).from(lyrics)
    .where(and(eq(lyrics.trackId, trackId), eq(lyrics.source, source))).limit(1);
  return { id: existing[0]?.id ?? 0 };
}

export async function getLyricsByTrack(trackId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lyrics).where(eq(lyrics.trackId, trackId));
}

// ── Audio Features helpers ──

export async function saveAudioFeatures(data: InsertAudioFeatures) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(audioFeatures).where(eq(audioFeatures.trackId, data.trackId)).limit(1);
  if (existing.length > 0) {
    await db.update(audioFeatures).set(data).where(eq(audioFeatures.id, existing[0].id));
    return { id: existing[0].id };
  }
  const result = await db.insert(audioFeatures).values(data);
  return { id: result[0].insertId };
}

export async function getAudioFeaturesByTrack(trackId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(audioFeatures).where(eq(audioFeatures.trackId, trackId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Review helpers ──

export async function createReview(data: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If this is a track review, handle versioning atomically
  if (data.trackId && data.reviewType === "track") {
    return db.transaction(async (tx) => {
      // Get the current latest version number for this track
      const existing = await tx.select({ reviewVersion: reviews.reviewVersion })
        .from(reviews)
        .where(and(
          eq(reviews.trackId, data.trackId!),
          eq(reviews.reviewType, "track"),
          eq(reviews.isLatest, true)
        ))
        .orderBy(desc(reviews.reviewVersion))
        .limit(1);

      const nextVersion = existing.length > 0 ? (existing[0].reviewVersion ?? 1) + 1 : 1;

      // Mark all previous reviews for this track as not latest
      await tx.update(reviews).set({ isLatest: false })
        .where(and(
          eq(reviews.trackId, data.trackId!),
          eq(reviews.reviewType, "track")
        ));

      // Insert with version info
      const result = await tx.insert(reviews).values({
        ...data,
        reviewVersion: nextVersion,
        isLatest: true,
      });
      return { id: result[0].insertId };
    });
  }

  // For album/comparison reviews, just insert normally
  const result = await db.insert(reviews).values(data);
  return { id: result[0].insertId };
}

export async function getReviewsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.projectId, projectId)).orderBy(desc(reviews.createdAt));
}

export async function getReviewsByTrack(trackId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.trackId, trackId)).orderBy(desc(reviews.createdAt));
}

export async function getReviewHistory(trackId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: reviews.id,
    reviewVersion: reviews.reviewVersion,
    isLatest: reviews.isLatest,
    modelUsed: reviews.modelUsed,
    scoresJson: reviews.scoresJson,
    quickTake: reviews.quickTake,
    createdAt: reviews.createdAt,
  }).from(reviews)
    .where(and(eq(reviews.trackId, trackId), eq(reviews.reviewType, "track")))
    .orderBy(desc(reviews.reviewVersion));
}

export async function getReviewById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAlbumReview(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reviews).where(and(eq(reviews.projectId, projectId), eq(reviews.reviewType, "album"))).orderBy(desc(reviews.createdAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Share token helpers ──

export async function getReviewByShareToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reviews).where(eq(reviews.shareToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setReviewShareToken(reviewId: number, token: string, expiresAt?: Date | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviews).set({ shareToken: token, shareExpiresAt: expiresAt ?? null }).where(eq(reviews.id, reviewId));
}

export async function revokeReviewShareToken(reviewId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviews).set({ shareToken: null, shareExpiresAt: null }).where(eq(reviews.id, reviewId));
}

// ── Job helpers ──

export async function createJob(data: InsertJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(jobs).values(data);
  return { id: result[0].insertId };
}

export async function getJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getJobsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobs).where(eq(jobs.projectId, projectId)).orderBy(desc(jobs.createdAt));
}

export async function getJobsByBatchId(batchId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobs).where(eq(jobs.batchId, batchId)).orderBy(desc(jobs.createdAt));
}

export async function updateJob(id: number, data: Partial<InsertJob>) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set(data).where(eq(jobs.id, id));
}

/**
 * Atomically claim the next queued job using UPDATE...WHERE to prevent races.
 * Also checks job dependencies (dependsOnJobId must be done before claiming).
 */
export async function claimNextQueuedJob(): Promise<any | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  // Find candidates: queued jobs ordered by creation time
  const candidates = await db.select().from(jobs)
    .where(eq(jobs.status, "queued"))
    .orderBy(asc(jobs.createdAt))
    .limit(5);

  for (const candidate of candidates) {
    // Check dependency: if this job depends on another, that job must be done
    if (candidate.dependsOnJobId) {
      const depJob = await db.select().from(jobs)
        .where(eq(jobs.id, candidate.dependsOnJobId))
        .limit(1);
      if (depJob.length > 0 && depJob[0].status !== "done") {
        // Dependency not met — skip for now
        if (depJob[0].status === "error") {
          // Dependency failed — fail this job too
          await db.update(jobs).set({
            status: "error",
            errorMessage: `Dependency job #${candidate.dependsOnJobId} failed`,
            completedAt: new Date(),
          }).where(eq(jobs.id, candidate.id));
        }
        continue;
      }
    }

    // Skip jobs that are waiting for retry backoff
    if (candidate.retryAfter && new Date(candidate.retryAfter) > new Date()) {
      continue;
    }

    // Check max attempts
    if (candidate.attempts >= (candidate.maxAttempts || 3)) {
      await db.update(jobs).set({
        status: "error",
        errorMessage: `Exceeded max attempts (${candidate.maxAttempts || 3})`,
        completedAt: new Date(),
      }).where(eq(jobs.id, candidate.id));
      continue;
    }

    // Atomic claim: UPDATE only if still queued (prevents race conditions)
    const result = await db.update(jobs).set({
      status: "running",
      progress: 5,
      progressMessage: "Starting...",
      heartbeatAt: new Date(),
      attempts: (candidate.attempts || 0) + 1,
    }).where(and(eq(jobs.id, candidate.id), eq(jobs.status, "queued")));

    // Check if we actually claimed it (affectedRows > 0)
    // Drizzle returns the result directly; if another worker claimed it first, no rows updated
    // Re-fetch to confirm status
    const claimed = await db.select().from(jobs)
      .where(and(eq(jobs.id, candidate.id), eq(jobs.status, "running")))
      .limit(1);
    if (claimed.length > 0) {
      return claimed[0];
    }
    // Someone else claimed it — try next candidate
  }

  return undefined;
}

/** @deprecated Use claimNextQueuedJob instead */
export async function getNextQueuedJob() {
  return claimNextQueuedJob();
}

/**
 * Find jobs that are "running" but have a stale heartbeat (>5 min) or no heartbeat.
 * These are likely from crashed server instances.
 */
export async function getStaleRunningJobs() {
  const db = await getDb();
  if (!db) return [];
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  return db.select().from(jobs)
    .where(and(
      eq(jobs.status, "running"),
      sql`(${jobs.heartbeatAt} IS NULL OR ${jobs.heartbeatAt} < ${fiveMinAgo})`
    ))
    .orderBy(asc(jobs.createdAt));
}

/** Update heartbeat timestamp for a running job */
export async function updateJobHeartbeat(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set({ heartbeatAt: new Date() }).where(eq(jobs.id, id));
}

export async function getActiveJobForTrack(trackId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs)
    .where(and(eq(jobs.trackId, trackId), sql`${jobs.status} IN ('queued', 'running')`))
    .orderBy(desc(jobs.createdAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLatestJobForTrack(trackId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs)
    .where(eq(jobs.trackId, trackId))
    .orderBy(desc(jobs.createdAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Conversation helpers ──

export async function createConversationMessage(data: InsertConversationMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(conversationMessages).values(data);
  return { id: result[0].insertId };
}

export async function getConversationByReview(reviewId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversationMessages).where(eq(conversationMessages.reviewId, reviewId)).orderBy(asc(conversationMessages.createdAt));
}

// ── Reference Track helpers ──

export async function createReferenceTrack(data: InsertReferenceTrack) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(referenceTracks).values(data);
  return { id: result[0].insertId };
}

export async function getReferenceTracksByTrack(trackId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referenceTracks).where(eq(referenceTracks.trackId, trackId)).orderBy(desc(referenceTracks.createdAt));
}

export async function getReferenceTrackById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(referenceTracks).where(eq(referenceTracks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateReferenceTrackComparison(id: number, comparisonResult: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(referenceTracks).set({ comparisonResult }).where(eq(referenceTracks.id, id));
}

// ── Score history for progress tracking ──

export async function getScoreHistoryForTrack(parentTrackId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all versions of this track and their latest review scores
  const allVersions = await db.select({
    trackId: tracks.id,
    versionNumber: tracks.versionNumber,
    originalFilename: tracks.originalFilename,
    createdAt: tracks.createdAt,
  }).from(tracks).where(
    sql`(${tracks.id} = ${parentTrackId} OR ${tracks.parentTrackId} = ${parentTrackId})`
  ).orderBy(asc(tracks.versionNumber));

  const scoreHistory = [];
  for (const version of allVersions) {
    const latestReview = await db.select().from(reviews)
      .where(and(eq(reviews.trackId, version.trackId), eq(reviews.reviewType, "track")))
      .orderBy(desc(reviews.createdAt)).limit(1);
    if (latestReview.length > 0 && latestReview[0].scoresJson) {
      scoreHistory.push({
        trackId: version.trackId,
        versionNumber: version.versionNumber,
        filename: version.originalFilename,
        createdAt: version.createdAt,
        scores: latestReview[0].scoresJson,
        quickTake: latestReview[0].quickTake,
      });
    }
  }
  return scoreHistory;
}

// ── Chat Session helpers ──

export async function createChatSession(data: InsertChatSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatSessions).values(data);
  return { id: result[0].insertId };
}

export async function getChatSessionsByUser(userId: number, projectId?: number, trackId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(chatSessions.userId, userId)];
  if (projectId) conditions.push(eq(chatSessions.projectId, projectId));
  if (trackId) conditions.push(eq(chatSessions.trackId, trackId));
  return db.select().from(chatSessions).where(and(...conditions)).orderBy(desc(chatSessions.lastActiveAt));
}

export async function getChatSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateChatSessionTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(chatSessions).set({ title, lastActiveAt: new Date() }).where(eq(chatSessions.id, id));
}

export async function touchChatSession(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(chatSessions).set({ lastActiveAt: new Date() }).where(eq(chatSessions.id, id));
}

export async function deleteChatSession(id: number) {
  const db = await getDb();
  if (!db) return;
  // FK ON DELETE CASCADE handles chatMessages
  await db.delete(chatSessions).where(eq(chatSessions.id, id));
}

export async function createChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatMessages).values(data);
  return { id: result[0].insertId };
}

export async function getChatMessagesBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(asc(chatMessages.createdAt));
}

export async function getRecentChatMessages(sessionId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(desc(chatMessages.createdAt)).limit(limit);
}

// ── Webhook Idempotency ──

export async function isWebhookEventProcessed(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(processedWebhookEvents).where(eq(processedWebhookEvents.eventId, eventId)).limit(1);
  return result.length > 0;
}

export async function markWebhookEventProcessed(eventId: string, eventType: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(processedWebhookEvents).values({ eventId, eventType });
  } catch {
    // Duplicate key — already processed, ignore
  }
}

// ── Monthly Review Tracking ──

export async function incrementMonthlyReviewCount(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users)
    .set({ monthlyReviewCount: sql`${users.monthlyReviewCount} + 1` })
    .where(eq(users.id, userId));
}

export async function resetMonthlyUsageIfNeeded(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const user = await getUserById(userId);
  if (!user) return;
  
  const now = new Date();
  const resetAt = new Date(user.monthlyResetAt);
  
  // If monthlyResetAt is in the past, reset counters and set next reset date
  if (now >= resetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1); // 1st of next month
    await db.update(users)
      .set({
        monthlyReviewCount: 0,
        audioMinutesUsed: 0,
        monthlyResetAt: nextReset,
      })
      .where(eq(users.id, userId));
  }
}

export async function getMonthlyReviewCount(userId: number): Promise<number> {
  const user = await getUserById(userId);
  return user?.monthlyReviewCount ?? 0;
}

export async function softDeleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users)
    .set({
      deletedAt: new Date(),
      tier: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      audioMinutesUsed: 0,
      audioMinutesLimit: 0,
      monthlyReviewCount: 0,
    })
    .where(eq(users.id, userId));
}


// ── Cover image helpers ──

export async function updateProjectCoverImage(projectId: number, coverImageUrl: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ coverImageUrl }).where(eq(projects.id, projectId));
}

// ── Favorites ──

export async function toggleFavorite(userId: number, trackId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(favorites).where(
    and(eq(favorites.userId, userId), eq(favorites.trackId, trackId))
  ).limit(1);

  if (existing.length > 0) {
    await db.delete(favorites).where(
      and(eq(favorites.userId, userId), eq(favorites.trackId, trackId))
    );
    return false; // unfavorited
  } else {
    await db.insert(favorites).values({ userId, trackId });
    return true; // favorited
  }
}

export async function getFavoritesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      favoriteId: favorites.id,
      trackId: favorites.trackId,
      favoritedAt: favorites.createdAt,
      trackName: tracks.originalFilename,
      trackStatus: tracks.status,
      projectId: tracks.projectId,
      projectTitle: projects.title,
      coverImageUrl: projects.coverImageUrl,
      detectedGenre: tracks.detectedGenre,
    })
    .from(favorites)
    .innerJoin(tracks, eq(favorites.trackId, tracks.id))
    .innerJoin(projects, eq(tracks.projectId, projects.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
}

export async function getFavoriteTrackIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ trackId: favorites.trackId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  return rows.map(r => r.trackId);
}


// ── Review Templates ──

export async function createReviewTemplate(data: InsertReviewTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviewTemplates).values(data);
  return { id: result[0].insertId };
}

export async function getReviewTemplatesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewTemplates).where(eq(reviewTemplates.userId, userId)).orderBy(desc(reviewTemplates.createdAt));
}

export async function getReviewTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reviewTemplates).where(eq(reviewTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateReviewTemplate(id: number, data: Partial<InsertReviewTemplate>) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviewTemplates).set(data).where(eq(reviewTemplates.id, id));
}

export async function deleteReviewTemplate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(reviewTemplates).where(eq(reviewTemplates.id, id));
}

export async function setDefaultTemplate(userId: number, templateId: number) {
  const db = await getDb();
  if (!db) return;
  // Unset all defaults for this user
  await db.update(reviewTemplates).set({ isDefault: false }).where(eq(reviewTemplates.userId, userId));
  // Set the new default
  await db.update(reviewTemplates).set({ isDefault: true }).where(and(eq(reviewTemplates.id, templateId), eq(reviewTemplates.userId, userId)));
}

// ── Project Collaborators ──

export async function createCollaboratorInvite(data: InsertProjectCollaborator) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projectCollaborators).values(data);
  return { id: result[0].insertId };
}

export async function getCollaboratorsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: projectCollaborators.id,
      projectId: projectCollaborators.projectId,
      invitedUserId: projectCollaborators.invitedUserId,
      invitedEmail: projectCollaborators.invitedEmail,
      role: projectCollaborators.role,
      status: projectCollaborators.status,
      createdAt: projectCollaborators.createdAt,
      userName: users.name,
    })
    .from(projectCollaborators)
    .leftJoin(users, eq(projectCollaborators.invitedUserId, users.id))
    .where(eq(projectCollaborators.projectId, projectId))
    .orderBy(desc(projectCollaborators.createdAt));
}

export async function getCollaboratorByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projectCollaborators).where(eq(projectCollaborators.inviteToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function acceptCollaboratorInvite(token: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectCollaborators).set({
    status: "accepted",
    invitedUserId: userId,
  }).where(eq(projectCollaborators.inviteToken, token));
}

export async function removeCollaborator(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectCollaborators).where(eq(projectCollaborators.id, id));
}

export async function isUserCollaborator(userId: number, projectId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(projectCollaborators)
    .where(and(
      eq(projectCollaborators.projectId, projectId),
      eq(projectCollaborators.invitedUserId, userId),
      eq(projectCollaborators.status, "accepted")
    )).limit(1);
  return result.length > 0;
}

export async function getCollaboratorRole(userId: number, projectId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ role: projectCollaborators.role }).from(projectCollaborators)
    .where(and(
      eq(projectCollaborators.projectId, projectId),
      eq(projectCollaborators.invitedUserId, userId),
      eq(projectCollaborators.status, "accepted")
    )).limit(1);
  return result.length > 0 ? result[0].role : null;
}

export async function getSharedProjectIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ projectId: projectCollaborators.projectId })
    .from(projectCollaborators)
    .where(and(
      eq(projectCollaborators.invitedUserId, userId),
      eq(projectCollaborators.status, "accepted")
    ));
  return rows.map(r => r.projectId);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


// ── Waveform Annotations (Feature 4) ──

export async function createAnnotation(data: InsertWaveformAnnotation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(waveformAnnotations).values(data);
  return result[0].insertId;
}

export async function getAnnotationsByTrack(trackId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: waveformAnnotations.id,
    trackId: waveformAnnotations.trackId,
    userId: waveformAnnotations.userId,
    userName: users.name,
    timestampMs: waveformAnnotations.timestampMs,
    content: waveformAnnotations.content,
    resolved: waveformAnnotations.resolved,
    createdAt: waveformAnnotations.createdAt,
  })
    .from(waveformAnnotations)
    .leftJoin(users, eq(waveformAnnotations.userId, users.id))
    .where(eq(waveformAnnotations.trackId, trackId))
    .orderBy(asc(waveformAnnotations.timestampMs));
}

export async function updateAnnotation(id: number, userId: number, data: { content?: string; resolved?: boolean }) {
  const db = await getDb();
  if (!db) return;
  await db.update(waveformAnnotations)
    .set(data)
    .where(and(eq(waveformAnnotations.id, id), eq(waveformAnnotations.userId, userId)));
}

export async function deleteAnnotation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(waveformAnnotations)
    .where(and(eq(waveformAnnotations.id, id), eq(waveformAnnotations.userId, userId)));
}

// ── Mix Reports (Feature 3) ──

export async function createMixReport(data: InsertMixReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mixReports).values(data);
  return result[0].insertId;
}

export async function getMixReportByTrack(trackId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mixReports)
    .where(eq(mixReports.trackId, trackId))
    .orderBy(desc(mixReports.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Structure Analysis (Feature 7) ──

export async function upsertStructureAnalysis(data: InsertStructureAnalysis) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(structureAnalyses).values(data)
    .onDuplicateKeyUpdate({ set: { sectionsJson: data.sectionsJson, structureScore: data.structureScore, genreExpectations: data.genreExpectations, suggestions: data.suggestions } });
}

export async function getStructureAnalysis(trackId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(structureAnalyses)
    .where(eq(structureAnalyses.trackId, trackId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Genre Benchmarking (Feature 5) ──

export async function getGenreBenchmarks(genre: string) {
  const db = await getDb();
  if (!db) return null;
  // Get average scores for all tracks in this genre
  const result = await db.select({
    trackCount: count(tracks.id),
  }).from(tracks)
    .where(eq(tracks.detectedGenre, genre));
  
  // Get all reviews with scores for tracks in this genre
  const reviewRows = await db.select({
    scoresJson: reviews.scoresJson,
  }).from(reviews)
    .innerJoin(tracks, eq(reviews.trackId, tracks.id))
    .where(and(
      eq(tracks.detectedGenre, genre),
      eq(reviews.isLatest, true),
      eq(reviews.reviewType, "track"),
    ));
  
  return { trackCount: result[0]?.trackCount || 0, reviews: reviewRows };
}

export async function getAllGenresWithCounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    genre: tracks.detectedGenre,
    count: count(tracks.id),
  }).from(tracks)
    .where(sql`${tracks.detectedGenre} IS NOT NULL AND ${tracks.detectedGenre} != ''`)
    .groupBy(tracks.detectedGenre)
    .orderBy(desc(count(tracks.id)));
}

// ── Revision Timeline (Feature 2) ──

export async function getVersionTimeline(parentTrackId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all versions of a track including the parent
  const allVersions = await db.select({
    id: tracks.id,
    versionNumber: tracks.versionNumber,
    filename: tracks.originalFilename,
    createdAt: tracks.createdAt,
    status: tracks.status,
  }).from(tracks)
    .where(sql`${tracks.id} = ${parentTrackId} OR ${tracks.parentTrackId} = ${parentTrackId}`)
    .orderBy(asc(tracks.versionNumber));
  
  // Get reviews with scores for each version
  const trackIds = allVersions.map(v => v.id);
  if (trackIds.length === 0) return [];
  
  const versionReviews = await db.select({
    trackId: reviews.trackId,
    scoresJson: reviews.scoresJson,
    createdAt: reviews.createdAt,
  }).from(reviews)
    .where(and(
      inArray(reviews.trackId, trackIds),
      eq(reviews.isLatest, true),
      eq(reviews.reviewType, "track"),
    ));
  
  return allVersions.map(v => ({
    ...v,
    review: versionReviews.find(r => r.trackId === v.id) || null,
  }));
}

// ── Export Session Notes (Feature 6) ──

export async function getTrackExportData(trackId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track) return null;
  
  const [features] = await db.select().from(audioFeatures).where(eq(audioFeatures.trackId, trackId)).limit(1);
  const [latestReview] = await db.select().from(reviews)
    .where(and(eq(reviews.trackId, trackId), eq(reviews.isLatest, true), eq(reviews.reviewType, "track")))
    .orderBy(desc(reviews.createdAt)).limit(1);
  const [mixReport] = await db.select().from(mixReports)
    .where(eq(mixReports.trackId, trackId))
    .orderBy(desc(mixReports.createdAt)).limit(1);
  const [structure] = await db.select().from(structureAnalyses)
    .where(eq(structureAnalyses.trackId, trackId)).limit(1);
  const [lyricsRow] = await db.select().from(lyrics)
    .where(eq(lyrics.trackId, trackId)).limit(1);
  
  return { track, features: features || null, review: latestReview || null, mixReport: mixReport || null, structure: structure || null, lyrics: lyricsRow || null };
}


// ── Project Insights helpers ──

export async function createProjectInsight(data: InsertProjectInsight) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projectInsights).values(data);
  return { id: result[0].insertId };
}

export async function getLatestProjectInsight(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(projectInsights)
    .where(eq(projectInsights.projectId, projectId))
    .orderBy(desc(projectInsights.createdAt)).limit(1);
  return row || null;
}

// ── Score Matrix helper (all tracks + scores in a project) ──

export async function getProjectScoreMatrix(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all tracks with their latest track-type review scores
  const allTracks = await db.select({
    id: tracks.id,
    filename: tracks.originalFilename,
    detectedGenre: tracks.detectedGenre,
    trackOrder: tracks.trackOrder,
  }).from(tracks)
    .where(eq(tracks.projectId, projectId))
    .orderBy(asc(tracks.trackOrder));

  const result: Array<{
    trackId: number;
    filename: string;
    genre: string | null;
    scores: Record<string, number>;
    overall: number | null;
  }> = [];

  for (const track of allTracks) {
    const [latestReview] = await db.select({
      scoresJson: reviews.scoresJson,
    }).from(reviews)
      .where(and(
        eq(reviews.trackId, track.id),
        eq(reviews.isLatest, true),
        eq(reviews.reviewType, "track"),
      ))
      .orderBy(desc(reviews.createdAt)).limit(1);

    if (latestReview?.scoresJson) {
      const scores = latestReview.scoresJson as Record<string, number>;
      const overall = scores.overall ?? null;
      result.push({
        trackId: track.id,
        filename: track.filename,
        genre: track.detectedGenre,
        scores,
        overall,
      });
    }
  }

  return result;
}

// ── CSV Export helper ──

export async function getProjectCsvData(projectId: number) {
  const db = await getDb();
  if (!db) return { project: null, rows: [] };

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return { project: null, rows: [] };

  const allTracks = await db.select().from(tracks)
    .where(eq(tracks.projectId, projectId))
    .orderBy(asc(tracks.trackOrder));

  const rows: Array<{
    trackName: string;
    genre: string;
    status: string;
    quickTake: string;
    scores: Record<string, number>;
    reviewDate: string;
  }> = [];

  for (const track of allTracks) {
    const [latestReview] = await db.select().from(reviews)
      .where(and(
        eq(reviews.trackId, track.id),
        eq(reviews.isLatest, true),
        eq(reviews.reviewType, "track"),
      ))
      .orderBy(desc(reviews.createdAt)).limit(1);

    rows.push({
      trackName: track.originalFilename,
      genre: track.detectedGenre || "",
      status: track.status,
      quickTake: latestReview?.quickTake || "",
      scores: (latestReview?.scoresJson as Record<string, number>) || {},
      reviewDate: latestReview ? new Date(latestReview.createdAt).toISOString() : "",
    });
  }

  return { project, rows };
}


// ── Round 41: Analytics Trends ──
export async function getWeeklyScoreTrends(userId: number, weeks = 12) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);

  const allReviews = await db.select({
    scoresJson: reviews.scoresJson,
    createdAt: reviews.createdAt,
  }).from(reviews).where(
    and(eq(reviews.userId, userId), eq(reviews.reviewType, "track"), gte(reviews.createdAt, cutoff))
  );

  // Group by ISO week
  const weekBuckets = new Map<string, { scores: number[]; count: number }>();
  for (const r of allReviews) {
    const scores = r.scoresJson as Record<string, number> | null;
    const overall = scores?.overall ?? scores?.Overall;
    if (overall === undefined || overall === null) continue;
    const d = new Date(r.createdAt);
    // Get Monday of the week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const weekKey = monday.toISOString().split("T")[0];
    if (!weekBuckets.has(weekKey)) weekBuckets.set(weekKey, { scores: [], count: 0 });
    const bucket = weekBuckets.get(weekKey)!;
    bucket.scores.push(overall);
    bucket.count++;
  }

  return Array.from(weekBuckets.entries())
    .map(([week, { scores, count }]) => ({
      week,
      avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      reviewCount: count,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export async function getActivityHeatmap(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90); // last 90 days

  const allReviews = await db.select({
    createdAt: reviews.createdAt,
  }).from(reviews).where(
    and(eq(reviews.userId, userId), gte(reviews.createdAt, cutoff))
  );

  // Build 7×24 grid (day-of-week × hour)
  const grid: Record<string, number> = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid[`${d}-${h}`] = 0;
    }
  }

  for (const r of allReviews) {
    const date = new Date(r.createdAt);
    const day = date.getDay(); // 0=Sun
    const hour = date.getHours();
    grid[`${day}-${hour}`]++;
  }

  return Object.entries(grid).map(([key, count]) => {
    const [day, hour] = key.split("-").map(Number);
    return { day, hour, count };
  });
}

export async function getImprovementRate(userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get tracks that have multiple review versions
  const allReviews = await db.select({
    trackId: reviews.trackId,
    scoresJson: reviews.scoresJson,
    reviewVersion: reviews.reviewVersion,
    createdAt: reviews.createdAt,
  }).from(reviews).where(
    and(eq(reviews.userId, userId), eq(reviews.reviewType, "track"))
  ).orderBy(asc(reviews.createdAt));

  // Group by track
  const trackReviews = new Map<number, { overall: number; version: number }[]>();
  for (const r of allReviews) {
    if (!r.trackId) continue;
    const scores = r.scoresJson as Record<string, number> | null;
    const overall = scores?.overall ?? scores?.Overall;
    if (overall === undefined) continue;
    if (!trackReviews.has(r.trackId)) trackReviews.set(r.trackId, []);
    trackReviews.get(r.trackId)!.push({ overall, version: r.reviewVersion ?? 1 });
  }

  let improved = 0;
  let declined = 0;
  let unchanged = 0;
  for (const [, versions] of Array.from(trackReviews)) {
    if (versions.length < 2) continue;
    const first = versions[0].overall;
    const last = versions[versions.length - 1].overall;
    if (last > first) improved++;
    else if (last < first) declined++;
    else unchanged++;
  }

  const total = improved + declined + unchanged;
  return {
    improved,
    declined,
    unchanged,
    total,
    improvementRate: total > 0 ? Math.round((improved / total) * 100) : 0,
  };
}

// ── Round 41: Sentiment Timeline ──
export async function getProjectSentimentTimeline(projectId: number) {
  const db = await getDb();
  if (!db) return [];

  const projectReviews = await db.select({
    id: reviews.id,
    trackId: reviews.trackId,
    quickTake: reviews.quickTake,
    scoresJson: reviews.scoresJson,
    reviewMarkdown: reviews.reviewMarkdown,
    createdAt: reviews.createdAt,
    reviewVersion: reviews.reviewVersion,
  }).from(reviews)
    .innerJoin(tracks, eq(reviews.trackId, tracks.id))
    .where(
      and(eq(tracks.projectId, projectId), eq(reviews.reviewType, "track"))
    )
    .orderBy(asc(reviews.createdAt));

  // Enrich with track names
  const enriched = [];
  for (const r of projectReviews) {
    const track = r.trackId ? await db.select({ filename: tracks.originalFilename }).from(tracks).where(eq(tracks.id, r.trackId)).limit(1) : [];
    enriched.push({
      ...r,
      trackName: track[0]?.filename ?? "Unknown",
    });
  }
  return enriched;
}


// ── Notification Helpers ──

const DEFAULT_NOTIFICATION_PREFS = {
  review_complete: true,
  collaboration_invite: true,
  collaboration_accepted: true,
  digest: true,
  payment_failed: true,
  system: true,
};

export type NotificationPreferences = typeof DEFAULT_NOTIFICATION_PREFS;

export function getDefaultNotificationPrefs(): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFS };
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return null;
  // Check user notification preferences before creating
  const user = await getUserById(data.userId);
  if (user) {
    const prefs = (user.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFS) as NotificationPreferences;
    const notifType = data.type as keyof NotificationPreferences;
    if (notifType in prefs && prefs[notifType] === false) {
      return null; // User has disabled this notification type
    }
  }
  const result = await db.insert(notifications).values(data);
  return result[0].insertId;
}

export async function getNotificationPreferences(userId: number): Promise<NotificationPreferences> {
  const user = await getUserById(userId);
  if (!user || !user.notificationPreferences) return { ...DEFAULT_NOTIFICATION_PREFS };
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(user.notificationPreferences as Partial<NotificationPreferences>) };
}

export async function updateNotificationPreferences(userId: number, prefs: Partial<NotificationPreferences>) {
  const db = await getDb();
  if (!db) return;
  const current = await getNotificationPreferences(userId);
  const merged = { ...current, ...prefs };
  await db.update(users).set({ notificationPreferences: merged }).where(eq(users.id, userId));
  return merged;
}

export async function getNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count || 0;
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

// ── Review Quality Helpers ──

export async function getReviewQualityMetadata(reviewId: number) {
  const db = await getDb();
  if (!db) return null;
  const [review] = await db.select({
    id: reviews.id,
    reviewMarkdown: reviews.reviewMarkdown,
    scoresJson: reviews.scoresJson,
    quickTake: reviews.quickTake,
    createdAt: reviews.createdAt,
    trackId: reviews.trackId,
  }).from(reviews).where(eq(reviews.id, reviewId));
  if (!review) return null;

  const text = review.reviewMarkdown || "";
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const sectionCount = (text.match(/^##\s/gm) || []).length;
  const scores = (review.scoresJson as Record<string, number>) || {};
  const scoreCount = Object.keys(scores).length;
  const hasQuickTake = !!review.quickTake;

  // Confidence: based on how complete the review is
  let confidence = 0;
  if (wordCount >= 200) confidence += 25;
  if (wordCount >= 500) confidence += 15;
  if (sectionCount >= 3) confidence += 20;
  if (scoreCount >= 5) confidence += 20;
  if (hasQuickTake) confidence += 10;
  if (wordCount >= 800) confidence += 10;
  confidence = Math.min(confidence, 100);

  // Freshness: check if track was updated after review
  let isStale = false;
  if (review.trackId) {
    const [track] = await db.select({ updatedAt: tracks.updatedAt }).from(tracks).where(eq(tracks.id, review.trackId));
    if (track && track.updatedAt > review.createdAt) {
      isStale = true;
    }
  }

  return {
    reviewId: review.id,
    wordCount,
    sectionCount,
    scoreCount,
    hasQuickTake,
    confidence,
    isStale,
    createdAt: review.createdAt,
  };
}

export async function getTrackReviewsWithQuality(trackId: number) {
  const db = await getDb();
  if (!db) return [];
  const trackReviews = await db.select({
    id: reviews.id,
    reviewMarkdown: reviews.reviewMarkdown,
    scoresJson: reviews.scoresJson,
    quickTake: reviews.quickTake,
    reviewVersion: reviews.reviewVersion,
    isLatest: reviews.isLatest,
    createdAt: reviews.createdAt,
    trackId: reviews.trackId,
  }).from(reviews)
    .where(and(eq(reviews.trackId, trackId), eq(reviews.reviewType, "track")))
    .orderBy(desc(reviews.reviewVersion));

  const [track] = await db.select({ updatedAt: tracks.updatedAt }).from(tracks).where(eq(tracks.id, trackId));

  return trackReviews.map(r => {
    const text = r.reviewMarkdown || "";
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const sectionCount = (text.match(/^##\s/gm) || []).length;
    const scores = (r.scoresJson as Record<string, number>) || {};
    const scoreCount = Object.keys(scores).length;
    const hasQuickTake = !!r.quickTake;

    let confidence = 0;
    if (wordCount >= 200) confidence += 25;
    if (wordCount >= 500) confidence += 15;
    if (sectionCount >= 3) confidence += 20;
    if (scoreCount >= 5) confidence += 20;
    if (hasQuickTake) confidence += 10;
    if (wordCount >= 800) confidence += 10;
    confidence = Math.min(confidence, 100);

    const isStale = track ? track.updatedAt > r.createdAt : false;

    return {
      reviewId: r.id,
      reviewVersion: r.reviewVersion,
      isLatest: r.isLatest,
      wordCount,
      sectionCount,
      scoreCount,
      confidence,
      isStale,
      createdAt: r.createdAt,
    };
  });
}

// ── Global Search ──
export async function globalSearch(userId: number, query: string, filter: string, limit: number) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query.toLowerCase()}%`;
  const results: Array<{
    type: "project" | "track" | "review";
    id: number;
    title: string;
    subtitle: string;
    url: string;
    score?: number;
    status?: string;
    createdAt: number;
  }> = [];

  // Search projects
  if (filter === "all" || filter === "projects") {
    const projectResults = await db.select()
      .from(projects)
      .where(and(
        eq(projects.userId, userId),
        or(
          sql`LOWER(${projects.title}) LIKE ${q}`,
          sql`LOWER(${projects.referenceArtists}) LIKE ${q}`,
          sql`LOWER(${projects.genre}) LIKE ${q}`,
        )
      ))
      .limit(limit);
    for (const p of projectResults) {
      results.push({
        type: "project",
        id: p.id,
        title: p.title,
        subtitle: [p.referenceArtists, p.genre].filter(Boolean).join(" · "),
        url: `/projects/${p.id}`,
        status: p.status ?? undefined,
        createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
      });
    }
  }

  // Search tracks
  if (filter === "all" || filter === "tracks") {
    const trackResults = await db.select()
      .from(tracks)
      .where(and(
        eq(tracks.userId, userId),
        or(
          sql`LOWER(${tracks.originalFilename}) LIKE ${q}`,
          sql`LOWER(${tracks.detectedGenre}) LIKE ${q}`,
        )
      ))
      .limit(limit);
    for (const t of trackResults) {
      results.push({
        type: "track",
        id: t.id,
        title: t.originalFilename,
        subtitle: [t.detectedGenre, t.status].filter(Boolean).join(" · "),
        url: `/tracks/${t.id}`,
        status: t.status ?? undefined,
        createdAt: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
      });
    }
  }

  // Search reviews
  if (filter === "all" || filter === "reviews") {
    const reviewResults = await db.select()
      .from(reviews)
      .innerJoin(tracks, eq(reviews.trackId, tracks.id))
      .where(and(
        eq(tracks.userId, userId),
        or(
          sql`LOWER(${reviews.quickTake}) LIKE ${q}`,
          sql`LOWER(${reviews.reviewMarkdown}) LIKE ${q}`,
        )
      ))
      .limit(limit);
    for (const r of reviewResults) {
      const quickTake = r.reviews.quickTake || "";
      results.push({
        type: "review",
        id: r.reviews.id,
        title: r.tracks.originalFilename,
        subtitle: quickTake.length > 80 ? quickTake.slice(0, 80) + "..." : quickTake,
        url: `/reviews/${r.reviews.id}`,
        score: (r.reviews.scoresJson as any)?.overall ?? undefined,
        createdAt: r.reviews.createdAt ? new Date(r.reviews.createdAt).getTime() : Date.now(),
      });
    }
  }

  results.sort((a, b) => b.createdAt - a.createdAt);
  return results.slice(0, limit);
}

// ── Track Reordering ──────────────────────────────────────────────────
export async function reorderTracks(projectId: number, orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const promises = orderedIds.map((trackId, index) =>
    db.update(tracks).set({ trackOrder: index }).where(
      and(eq(tracks.id, trackId), eq(tracks.projectId, projectId))
    )
  );
  await Promise.all(promises);
  return { success: true };
}

// ── Review Digest ─────────────────────────────────────────────────────
export async function getDigestData(userId: number, daysBack: number = 7) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const recentReviews = await db.select({
    id: reviews.id,
    trackId: reviews.trackId,
    trackFilename: tracks.originalFilename,
    projectTitle: projects.title,
    projectId: projects.id,
    scoresJson: reviews.scoresJson,
    quickTake: reviews.quickTake,
    createdAt: reviews.createdAt,
  })
    .from(reviews)
    .innerJoin(tracks, eq(reviews.trackId, tracks.id))
    .innerJoin(projects, eq(tracks.projectId, projects.id))
    .where(and(
      eq(projects.userId, userId),
      gte(reviews.createdAt, since)
    ))
    .orderBy(desc(reviews.createdAt))
    .limit(50);

  const recentProjects = await db.select({
    id: projects.id,
    title: projects.title,
    status: projects.status,
    createdAt: projects.createdAt,
  })
    .from(projects)
    .where(and(eq(projects.userId, userId), gte(projects.createdAt, since)))
    .orderBy(desc(projects.createdAt))
    .limit(20);

  // Compute summary stats
  let totalScore = 0;
  let scoreCount = 0;
  let highestScore = 0;
  let lowestScore = 10;
  let highestTrack = "";
  let lowestTrack = "";

  for (const r of recentReviews) {
    try {
      const scores = typeof r.scoresJson === "string" ? JSON.parse(r.scoresJson) : r.scoresJson;
      const overall = scores?.overall ?? scores?.overallScore;
      if (typeof overall === "number") {
        totalScore += overall;
        scoreCount++;
        if (overall > highestScore) { highestScore = overall; highestTrack = r.trackFilename; }
        if (overall < lowestScore) { lowestScore = overall; lowestTrack = r.trackFilename; }
      }
    } catch {}
  }

  return {
    period: { daysBack, since: since.toISOString() },
    reviews: recentReviews,
    newProjects: recentProjects,
    stats: {
      totalReviews: recentReviews.length,
      totalNewProjects: recentProjects.length,
      averageScore: scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : null,
      highestScore: scoreCount > 0 ? { score: highestScore, track: highestTrack } : null,
      lowestScore: scoreCount > 0 ? { score: lowestScore, track: lowestTrack } : null,
    },
  };
}

// ── Review Comments ───────────────────────────────────────────────────
export async function getReviewComments(reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select({
    id: reviewComments.id,
    reviewId: reviewComments.reviewId,
    userId: reviewComments.userId,
    userName: users.name,
    content: reviewComments.content,
    parentId: reviewComments.parentId,
    createdAt: reviewComments.createdAt,
    updatedAt: reviewComments.updatedAt,
  })
    .from(reviewComments)
    .innerJoin(users, eq(reviewComments.userId, users.id))
    .where(eq(reviewComments.reviewId, reviewId))
    .orderBy(asc(reviewComments.createdAt));
  return results;
}

export async function createReviewComment(data: {
  reviewId: number;
  userId: number;
  content: string;
  parentId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(reviewComments).values({
    reviewId: data.reviewId,
    userId: data.userId,
    content: data.content,
    parentId: data.parentId || null,
  });
  return { id: result.insertId };
}

export async function deleteReviewComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reviewComments).where(
    and(eq(reviewComments.id, commentId), eq(reviewComments.userId, userId))
  );
  return { success: true };
}

export async function updateReviewComment(commentId: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reviewComments).set({ content }).where(
    and(eq(reviewComments.id, commentId), eq(reviewComments.userId, userId))
  );
  return { success: true };
}

// ── Artwork Concepts ──

export async function createArtworkConcept(data: InsertArtworkConcept) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(artworkConcepts).values(data).$returningId();
  return result;
}

export async function getArtworkConceptsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(artworkConcepts).where(eq(artworkConcepts.projectId, projectId)).orderBy(desc(artworkConcepts.createdAt));
}

export async function updateArtworkConcept(id: number, data: Partial<{ imageUrl: string; status: "generating" | "complete" | "error"; moodDescription: string; colorPalette: string[]; visualStyle: string }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(artworkConcepts).set(data).where(eq(artworkConcepts.id, id));
}

export async function deleteArtworkConcept(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(artworkConcepts).where(eq(artworkConcepts.id, id));
}

// ── Mastering Checklists ──

export async function createMasteringChecklist(data: InsertMasteringChecklist) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(masteringChecklists).values(data).$returningId();
  return result;
}

export async function getMasteringChecklistByTrack(trackId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(masteringChecklists).where(eq(masteringChecklists.trackId, trackId)).orderBy(desc(masteringChecklists.createdAt)).limit(1);
  return rows[0] || null;
}

export async function updateMasteringChecklist(id: number, data: Partial<{ itemsJson: any; overallReadiness: number }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(masteringChecklists).set(data).where(eq(masteringChecklists.id, id));
}

// ── Track Notes ──

export async function createTrackNote(data: InsertTrackNote) {
  const d = await getDb();
  if (!d) throw new Error("DB unavailable");
  const result = await d.insert(trackNotes).values(data);
  return { id: Number(result[0].insertId) };
}

export async function listTrackNotes(trackId: number, userId: number) {
  const d = await getDb();
  if (!d) return [];
  return d.select().from(trackNotes)
    .where(and(eq(trackNotes.trackId, trackId), eq(trackNotes.userId, userId)))
    .orderBy(desc(trackNotes.pinned), desc(trackNotes.createdAt));
}

export async function updateTrackNote(noteId: number, data: Partial<Pick<InsertTrackNote, "content" | "pinned">>) {
  const d = await getDb();
  if (!d) throw new Error("DB unavailable");
  await d.update(trackNotes).set(data).where(eq(trackNotes.id, noteId));
}

export async function deleteTrackNote(noteId: number) {
  const d = await getDb();
  if (!d) throw new Error("DB unavailable");
  await d.delete(trackNotes).where(eq(trackNotes.id, noteId));
}

export async function getTrackNoteById(noteId: number) {
  const d = await getDb();
  if (!d) return null;
  const rows = await d.select().from(trackNotes).where(eq(trackNotes.id, noteId)).limit(1);
  return rows[0] || null;
}


// ── Round 53: Portfolio Export Data ──

export async function getPortfolioData(projectId: number) {
  const d = await getDb();
  if (!d) throw new Error("DB unavailable");

  const [project] = await d.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;

  const allTracks = await d.select().from(tracks)
    .where(eq(tracks.projectId, projectId))
    .orderBy(asc(tracks.trackOrder));

  const allReviews = await d.select().from(reviews)
    .where(and(eq(reviews.projectId, projectId), eq(reviews.isLatest, true)))
    .orderBy(desc(reviews.createdAt));

  const allFeatures = await d.select().from(audioFeatures)
    .where(
      inArray(audioFeatures.trackId, allTracks.map(t => t.id).length > 0 ? allTracks.map(t => t.id) : [0])
    );

  // Get artwork concepts
  const artwork = await d.select().from(artworkConcepts)
    .where(and(eq(artworkConcepts.projectId, projectId), eq(artworkConcepts.status, "complete")))
    .orderBy(desc(artworkConcepts.createdAt))
    .limit(4);

  // Get project insight
  const [insight] = await d.select().from(projectInsights)
    .where(eq(projectInsights.projectId, projectId))
    .orderBy(desc(projectInsights.createdAt))
    .limit(1);

  return {
    project,
    tracks: allTracks,
    reviews: allReviews,
    audioFeatures: allFeatures,
    artwork,
    insight: insight || null,
  };
}

// ── Round 53: All Users for Digest ──

export async function getAllActiveUsers() {
  const d = await getDb();
  if (!d) return [];
  return d.select({
    id: users.id,
    name: users.name,
    email: users.email,
    tier: users.tier,
  }).from(users).where(isNull(users.deletedAt));
}

// ── Round 53: Delete Reference Track ──

export async function deleteReferenceTrack(id: number) {
  const d = await getDb();
  if (!d) throw new Error("DB unavailable");
  await d.delete(referenceTracks).where(eq(referenceTracks.id, id));
}

export async function updateUserDigestFrequency(
  userId: number,
  frequency: "weekly" | "biweekly" | "monthly" | "disabled"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ digestFrequency: frequency }).where(eq(users.id, userId));
}

export async function updateLastDigestSentAt(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastDigestSentAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserPreferredPersona(
  userId: number,
  persona: "songwriter" | "producer" | "arranger" | "artist" | "anr" | "full"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ preferredPersona: persona }).where(eq(users.id, userId));
}

export async function getUserPreferredPersona(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "full";
  const [user] = await db.select({ preferredPersona: users.preferredPersona }).from(users).where(eq(users.id, userId));
  return user?.preferredPersona ?? "full";
}


// ── Action Mode Cache ──

export async function getCachedActionMode(reviewId: number, mode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(actionModeCache)
    .where(and(eq(actionModeCache.reviewId, reviewId), eq(actionModeCache.mode, mode)))
    .limit(1);
  return rows[0];
}

export async function setCachedActionMode(reviewId: number, userId: number, mode: string, content: string) {
  const db = await getDb();
  if (!db) return;
  // Upsert: insert or update on duplicate key
  await db.insert(actionModeCache).values({
    reviewId,
    userId,
    mode,
    content,
  }).onDuplicateKeyUpdate({
    set: { content, createdAt: sql`NOW()` },
  });
}

export async function invalidateActionModeCache(reviewId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(actionModeCache).where(eq(actionModeCache.reviewId, reviewId));
}


// ── Platform Stats (public, for landing page) ──
export async function getPlatformStats() {
  const db = await getDb();
  if (!db) return { totalReviews: 0, totalTracks: 0, totalProjects: 0, totalUsers: 0 };

  const [reviewCount] = await db.select({ count: count() }).from(reviews);
  const [trackCount] = await db.select({ count: count() }).from(tracks);
  const [projectCount] = await db.select({ count: count() }).from(projects);
  const [userCount] = await db.select({ count: count() }).from(users);

  return {
    totalReviews: reviewCount?.count ?? 0,
    totalTracks: trackCount?.count ?? 0,
    totalProjects: projectCount?.count ?? 0,
    totalUsers: userCount?.count ?? 0,
  };
}

// ── Admin Dashboard Helpers ──
export async function getAdminUserList() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      tier: users.tier,
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
      monthlyReviewCount: users.monthlyReviewCount,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(desc(users.createdAt));
  return result;
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, activeSubscriptions: 0, reviewsThisMonth: 0, totalProjects: 0, tierBreakdown: { free: 0, artist: 0, pro: 0 } };

  const [userCount] = await db.select({ count: count() }).from(users).where(isNull(users.deletedAt));
  const [subCount] = await db.select({ count: count() }).from(users).where(and(isNull(users.deletedAt), sql`${users.stripeSubscriptionId} IS NOT NULL`));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [recentReviews] = await db.select({ count: count() }).from(reviews).where(gte(reviews.createdAt, thirtyDaysAgo));
  const [projectCount] = await db.select({ count: count() }).from(projects);

  // Tier breakdown
  const [freeCount] = await db.select({ count: count() }).from(users).where(and(isNull(users.deletedAt), eq(users.tier, "free")));
  const [artistCount] = await db.select({ count: count() }).from(users).where(and(isNull(users.deletedAt), eq(users.tier, "artist")));
  const [proCount] = await db.select({ count: count() }).from(users).where(and(isNull(users.deletedAt), eq(users.tier, "pro")));

  return {
    totalUsers: userCount?.count ?? 0,
    activeSubscriptions: subCount?.count ?? 0,
    reviewsThisMonth: recentReviews?.count ?? 0,
    totalProjects: projectCount?.count ?? 0,
    tierBreakdown: {
      free: freeCount?.count ?? 0,
      artist: artistCount?.count ?? 0,
      pro: proCount?.count ?? 0,
    },
  };
}

export async function getAdminRecentActivity() {
  const db = await getDb();
  if (!db) return [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentReviews = await db
    .select({
      id: reviews.id,
      trackId: reviews.trackId,
      reviewType: reviews.reviewType,
      modelUsed: reviews.modelUsed,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(gte(reviews.createdAt, sevenDaysAgo))
    .orderBy(desc(reviews.createdAt))
    .limit(20);
  return recentReviews;
}

// ── Admin User Management Helpers ──

export async function getAdminUserDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      tier: users.tier,
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
      monthlyReviewCount: users.monthlyReviewCount,
      monthlyResetAt: users.monthlyResetAt,
      audioMinutesUsed: users.audioMinutesUsed,
      audioMinutesLimit: users.audioMinutesLimit,
      digestFrequency: users.digestFrequency,
      preferredPersona: users.preferredPersona,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));

  if (!user) return null;

  // Get user's project count
  const [projectCount] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.userId, userId));

  // Get user's total review count
  const [reviewCount] = await db
    .select({ count: count() })
    .from(reviews)
    .where(eq(reviews.userId, userId));

  // Get user's track count
  const [trackCount] = await db
    .select({ count: count() })
    .from(tracks)
    .where(eq(tracks.userId, userId));

  // Get recent reviews (last 10)
  const recentReviews = await db
    .select({
      id: reviews.id,
      trackId: reviews.trackId,
      reviewType: reviews.reviewType,
      modelUsed: reviews.modelUsed,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(10);

  return {
    ...user,
    stats: {
      totalProjects: projectCount?.count ?? 0,
      totalReviews: reviewCount?.count ?? 0,
      totalTracks: trackCount?.count ?? 0,
    },
    recentReviews,
  };
}

export async function adminUpdateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return false;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return true;
}

export async function adminUpdateUserTier(userId: number, tier: "free" | "artist" | "pro") {
  const db = await getDb();
  if (!db) return false;
  await db.update(users).set({ tier }).where(eq(users.id, userId));
  return true;
}

export async function adminResetUserMonthlyCount(userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(users).set({ monthlyReviewCount: 0, monthlyResetAt: new Date() }).where(eq(users.id, userId));
  return true;
}


// ── Admin Audit Log Helpers ──

export async function createAuditLogEntry(data: {
  adminUserId: number;
  action: string;
  targetUserId?: number;
  details?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(adminAuditLog).values({
    adminUserId: data.adminUserId,
    action: data.action,
    targetUserId: data.targetUserId ?? null,
    details: data.details ?? null,
  });
  return result.insertId;
}

export async function getAuditLog(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: adminAuditLog.id,
    adminUserId: adminAuditLog.adminUserId,
    adminName: users.name,
    action: adminAuditLog.action,
    targetUserId: adminAuditLog.targetUserId,
    details: adminAuditLog.details,
    createdAt: adminAuditLog.createdAt,
  })
    .from(adminAuditLog)
    .leftJoin(users, eq(adminAuditLog.adminUserId, users.id))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}

export async function getAuditLogByUser(targetUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: adminAuditLog.id,
    adminUserId: adminAuditLog.adminUserId,
    adminName: users.name,
    action: adminAuditLog.action,
    targetUserId: adminAuditLog.targetUserId,
    details: adminAuditLog.details,
    createdAt: adminAuditLog.createdAt,
  })
    .from(adminAuditLog)
    .leftJoin(users, eq(adminAuditLog.adminUserId, users.id))
    .where(eq(adminAuditLog.targetUserId, targetUserId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}

// ── User Growth & Analytics Helpers ──

export async function getUserGrowthData(days = 90) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const result = await db.select({
    date: sql<string>`DATE(${users.createdAt})`.as("date"),
    count: count().as("count"),
  })
    .from(users)
    .where(gte(users.createdAt, since))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(asc(sql`DATE(${users.createdAt})`));
  
  return result;
}

export async function getReviewGrowthData(days = 90) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const result = await db.select({
    date: sql<string>`DATE(${reviews.createdAt})`.as("date"),
    count: count().as("count"),
  })
    .from(reviews)
    .where(gte(reviews.createdAt, since))
    .groupBy(sql`DATE(${reviews.createdAt})`)
    .orderBy(asc(sql`DATE(${reviews.createdAt})`));
  
  return result;
}

export async function getTierTransitionData() {
  const db = await getDb();
  if (!db) return { free: 0, artist: 0, pro: 0, withStripe: 0 };
  
  const [freeCount] = await db.select({ count: count() }).from(users).where(eq(users.tier, "free"));
  const [artistCount] = await db.select({ count: count() }).from(users).where(eq(users.tier, "artist"));
  const [proCount] = await db.select({ count: count() }).from(users).where(eq(users.tier, "pro"));
  const [stripeCount] = await db.select({ count: count() }).from(users).where(sql`${users.stripeSubscriptionId} IS NOT NULL`);
  
  return {
    free: freeCount?.count ?? 0,
    artist: artistCount?.count ?? 0,
    pro: proCount?.count ?? 0,
    withStripe: stripeCount?.count ?? 0,
  };
}


// ── Retention / Churn Metrics ──

export async function getRetentionMetrics() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, activeUsers: 0, inactiveUsers: 0, retentionRate: 0, avgDaysSinceLogin: 0 };

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [total] = await db.select({ count: count() }).from(users);
  const [active] = await db.select({ count: count() }).from(users)
    .where(gte(users.lastSignedIn, thirtyDaysAgo));
  
  const totalUsers = total?.count ?? 0;
  const activeUsers = active?.count ?? 0;
  const inactiveUsers = totalUsers - activeUsers;
  const retentionRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 10000) / 100 : 0;

  // Average days since last login for all users
  const avgResult = await db.select({
    avgDays: sql<number>`AVG(DATEDIFF(NOW(), ${users.lastSignedIn}))`.as("avgDays"),
  }).from(users).where(sql`${users.lastSignedIn} IS NOT NULL`);
  const avgDaysSinceLogin = Math.round(avgResult[0]?.avgDays ?? 0);

  return { totalUsers, activeUsers, inactiveUsers, retentionRate, avgDaysSinceLogin };
}

// ── Admin CSV Export Helpers ──

export async function exportUsersCSV() {
  const db = await getDb();
  if (!db) return "";

  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    tier: users.tier,
    monthlyReviewCount: users.monthlyReviewCount,
    stripeCustomerId: users.stripeCustomerId,
    stripeSubscriptionId: users.stripeSubscriptionId,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));

  const headers = ["ID", "Name", "Email", "Role", "Tier", "Monthly Reviews", "Stripe Customer", "Stripe Subscription", "Created At", "Last Login"];
  const rows = allUsers.map(u => [
    u.id,
    escapeCSV(u.name ?? ""),
    escapeCSV(u.email ?? ""),
    u.role,
    u.tier,
    u.monthlyReviewCount ?? 0,
    u.stripeCustomerId ?? "",
    u.stripeSubscriptionId ?? "",
    u.createdAt ? new Date(u.createdAt).toISOString() : "",
    u.lastSignedIn ? new Date(u.lastSignedIn).toISOString() : "",
  ].join(","));

  return [headers.join(","), ...rows].join("\n");
}

export async function exportAuditLogCSV() {
  const db = await getDb();
  if (!db) return "";

  const entries = await db.select({
    id: adminAuditLog.id,
    action: adminAuditLog.action,
    adminName: sql<string>`admin_user.name`.as("adminName"),
    targetName: sql<string>`target_user.name`.as("targetName"),
    details: adminAuditLog.details,
    createdAt: adminAuditLog.createdAt,
  })
    .from(adminAuditLog)
    .leftJoin(sql`${users} AS admin_user`, sql`admin_user.id = ${adminAuditLog.adminUserId}`)
    .leftJoin(sql`${users} AS target_user`, sql`target_user.id = ${adminAuditLog.targetUserId}`)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(5000);

  const headers = ["ID", "Action", "Admin", "Target User", "Details", "Created At"];
  const rows = entries.map(e => [
    e.id,
    e.action,
    escapeCSV(e.adminName ?? ""),
    escapeCSV(e.targetName ?? ""),
    escapeCSV(typeof e.details === "string" ? e.details : JSON.stringify(e.details ?? {})),
    e.createdAt ? new Date(e.createdAt).toISOString() : "",
  ].join(","));

  return [headers.join(","), ...rows].join("\n");
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── Cohort Analysis ──
export async function getCohortData(months = 12) {
  const db = await getDb();
  if (!db) return [];

  // Get signup cohorts by month
  const cohortRows = await db.execute(sql`
    SELECT
      DATE_FORMAT(createdAt, '%Y-%m') AS cohortMonth,
      COUNT(*) AS signupCount
    FROM users
    WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL ${months} MONTH)
      AND deletedAt IS NULL
    GROUP BY cohortMonth
    ORDER BY cohortMonth ASC
  `);

  const cohorts: Array<{
    cohortMonth: string;
    signupCount: number;
    retainedAt30d: number;
    retainedAt60d: number;
    retainedAt90d: number;
    retentionRate30d: number;
    retentionRate60d: number;
    retentionRate90d: number;
  }> = [];

  for (const row of (cohortRows as any)[0] || []) {
    const cohortMonth = row.cohortMonth as string;
    const signupCount = Number(row.signupCount);

    // For each cohort, check how many are still active at 30d, 60d, 90d intervals
    const retentionRows = await db.execute(sql`
      SELECT
        SUM(CASE WHEN lastSignedIn >= DATE_ADD(
          STR_TO_DATE(CONCAT(${cohortMonth}, '-01'), '%Y-%m-%d'),
          INTERVAL 30 DAY
        ) THEN 1 ELSE 0 END) AS retained30,
        SUM(CASE WHEN lastSignedIn >= DATE_ADD(
          STR_TO_DATE(CONCAT(${cohortMonth}, '-01'), '%Y-%m-%d'),
          INTERVAL 60 DAY
        ) THEN 1 ELSE 0 END) AS retained60,
        SUM(CASE WHEN lastSignedIn >= DATE_ADD(
          STR_TO_DATE(CONCAT(${cohortMonth}, '-01'), '%Y-%m-%d'),
          INTERVAL 90 DAY
        ) THEN 1 ELSE 0 END) AS retained90
      FROM users
      WHERE DATE_FORMAT(createdAt, '%Y-%m') = ${cohortMonth}
        AND deletedAt IS NULL
    `);

    const retRow = ((retentionRows as any)[0] || [])[0] || {};
    const retained30 = Number(retRow.retained30 || 0);
    const retained60 = Number(retRow.retained60 || 0);
    const retained90 = Number(retRow.retained90 || 0);

    cohorts.push({
      cohortMonth,
      signupCount,
      retainedAt30d: retained30,
      retainedAt60d: retained60,
      retainedAt90d: retained90,
      retentionRate30d: signupCount > 0 ? Math.round((retained30 / signupCount) * 100) : 0,
      retentionRate60d: signupCount > 0 ? Math.round((retained60 / signupCount) * 100) : 0,
      retentionRate90d: signupCount > 0 ? Math.round((retained90 / signupCount) * 100) : 0,
    });
  }

  return cohorts;
}

// ── Tier Change History (Subscription Lifecycle) ──

export async function getTierChangeHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all tier change audit log entries for this user, plus the user's creation date and initial tier
  const entries = await db.select({
    id: adminAuditLog.id,
    adminUserId: adminAuditLog.adminUserId,
    adminName: users.name,
    action: adminAuditLog.action,
    details: adminAuditLog.details,
    createdAt: adminAuditLog.createdAt,
  })
    .from(adminAuditLog)
    .leftJoin(users, eq(adminAuditLog.adminUserId, users.id))
    .where(
      and(
        eq(adminAuditLog.targetUserId, userId),
        eq(adminAuditLog.action, "update_tier")
      )
    )
    .orderBy(asc(adminAuditLog.createdAt))
    .limit(100);
  
  return entries;
}


// ── Admin Notification Preferences ──

export interface AdminNotificationPreferences {
  churnAlerts: boolean;
  newSignups: boolean;
  paymentEvents: boolean;
  churnThreshold: number;
  digestFrequency: "realtime" | "daily" | "weekly" | "off";
}

const DEFAULT_ADMIN_NOTIF_PREFS: AdminNotificationPreferences = {
  churnAlerts: true,
  newSignups: true,
  paymentEvents: true,
  churnThreshold: 50,
  digestFrequency: "daily",
};

export async function getAdminNotificationPrefs(adminUserId: number): Promise<AdminNotificationPreferences> {
  const db = await getDb();
  if (!db) return DEFAULT_ADMIN_NOTIF_PREFS;

  const row = await db.select()
    .from(adminSettings)
    .where(
      and(
        eq(adminSettings.adminUserId, adminUserId),
        eq(adminSettings.settingKey, "notification_preferences")
      )
    )
    .limit(1);

  if (row.length === 0) return DEFAULT_ADMIN_NOTIF_PREFS;
  return { ...DEFAULT_ADMIN_NOTIF_PREFS, ...(row[0].settingValue as Partial<AdminNotificationPreferences>) };
}

export async function setAdminNotificationPrefs(
  adminUserId: number,
  prefs: Partial<AdminNotificationPreferences>
): Promise<AdminNotificationPreferences> {
  const db = await getDb();
  if (!db) return { ...DEFAULT_ADMIN_NOTIF_PREFS, ...prefs };

  const current = await getAdminNotificationPrefs(adminUserId);
  const merged = { ...current, ...prefs };

  // Upsert: try insert, on duplicate key update
  await db.insert(adminSettings)
    .values({
      adminUserId,
      settingKey: "notification_preferences",
      settingValue: merged as Record<string, unknown>,
    })
    .onDuplicateKeyUpdate({
      set: {
        settingValue: merged as Record<string, unknown>,
      },
    });

  return merged;
}

export async function getAdminsWithPref(prefKey: keyof AdminNotificationPreferences, expectedValue: unknown): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // Get all admin users
  const admins = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  // For each admin, check their preferences
  const result: number[] = [];
  for (const admin of admins) {
    const prefs = await getAdminNotificationPrefs(admin.id);
    if (prefs[prefKey] === expectedValue) {
      result.push(admin.id);
    }
  }
  return result;
}


// ── Admin User Search / Filter ──

export async function searchAdminUsers(filters: {
  query?: string;
  tier?: "free" | "artist" | "pro" | "all";
  role?: "user" | "admin" | "all";
  status?: "active" | "inactive" | "all";
  sortBy?: "name" | "createdAt" | "lastSignedIn" | "monthlyReviewCount";
  sortOrder?: "asc" | "desc";
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];

  // Text search on name or email
  if (filters.query && filters.query.trim()) {
    const q = `%${filters.query.trim()}%`;
    conditions.push(
      or(
        sql`${users.name} LIKE ${q}`,
        sql`${users.email} LIKE ${q}`
      )
    );
  }

  // Tier filter
  if (filters.tier && filters.tier !== "all") {
    conditions.push(eq(users.tier, filters.tier));
  }

  // Role filter
  if (filters.role && filters.role !== "all") {
    conditions.push(eq(users.role, filters.role));
  }

  // Activity status filter (active = signed in within 30 days)
  if (filters.status === "active") {
    conditions.push(gte(users.lastSignedIn, sql`DATE_SUB(NOW(), INTERVAL 30 DAY)`));
  } else if (filters.status === "inactive") {
    conditions.push(sql`${users.lastSignedIn} < DATE_SUB(NOW(), INTERVAL 30 DAY)`);
  }

  // Build sort
  const sortCol = filters.sortBy === "name" ? users.name
    : filters.sortBy === "lastSignedIn" ? users.lastSignedIn
    : filters.sortBy === "monthlyReviewCount" ? users.monthlyReviewCount
    : users.createdAt;
  const sortDir = filters.sortOrder === "asc" ? asc : desc;

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    tier: users.tier,
    monthlyReviewCount: users.monthlyReviewCount,
    stripeCustomerId: users.stripeCustomerId,
    stripeSubscriptionId: users.stripeSubscriptionId,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  })
    .from(users)
    .where(whereClause)
    .orderBy(sortDir(sortCol))
    .limit(500);
}

// ── System Health Metrics ──

export async function getSystemHealthMetrics() {
  const db = await getDb();
  if (!db) return {
    serverUptime: process.uptime(),
    databaseConnected: false,
    totalUsers: 0,
    totalReviews: 0,
    totalProjects: 0,
    reviewsLast24h: 0,
    reviewsLast7d: 0,
    activeJobsCount: 0,
    errorJobsCount: 0,
    avgReviewsPerUser: 0,
    schedulerStatus: { digestScheduler: "unknown", churnAlertScheduler: "unknown" },
  };

  const [userCount] = await db.select({ count: count() }).from(users);
  const [reviewCount] = await db.select({ count: count() }).from(reviews);
  const [projectCount] = await db.select({ count: count() }).from(projects);

  const [reviews24h] = await db.select({ count: count() })
    .from(reviews)
    .where(gte(reviews.createdAt, sql`DATE_SUB(NOW(), INTERVAL 1 DAY)`));

  const [reviews7d] = await db.select({ count: count() })
    .from(reviews)
    .where(gte(reviews.createdAt, sql`DATE_SUB(NOW(), INTERVAL 7 DAY)`));

  const [activeJobs] = await db.select({ count: count() })
    .from(jobs)
    .where(eq(jobs.status, "running"));

  const [errorJobs] = await db.select({ count: count() })
    .from(jobs)
    .where(eq(jobs.status, "error"));

  const avgReviews = reviewCount.count > 0 && userCount.count > 0
    ? Math.round((reviewCount.count / userCount.count) * 10) / 10
    : 0;

  return {
    serverUptime: process.uptime(),
    databaseConnected: true,
    totalUsers: userCount.count,
    totalReviews: reviewCount.count,
    totalProjects: projectCount.count,
    reviewsLast24h: reviews24h.count,
    reviewsLast7d: reviews7d.count,
    activeJobsCount: activeJobs.count,
    errorJobsCount: errorJobs.count,
    avgReviewsPerUser: avgReviews,
    schedulerStatus: {
      digestScheduler: "running",
      churnAlertScheduler: "running",
    },
  };
}


// ── Bulk User Actions ──

export async function bulkUpdateUserTier(userIds: number[], tier: "free" | "artist" | "pro") {
  const db = await getDb();
  if (!db || userIds.length === 0) return { updated: 0 };
  const result = await db.update(users)
    .set({ tier, updatedAt: new Date() })
    .where(inArray(users.id, userIds));
  return { updated: result[0]?.affectedRows ?? userIds.length };
}

export async function bulkUpdateUserRole(userIds: number[], role: "user" | "admin") {
  const db = await getDb();
  if (!db || userIds.length === 0) return { updated: 0 };
  const result = await db.update(users)
    .set({ role, updatedAt: new Date() })
    .where(inArray(users.id, userIds));
  return { updated: result[0]?.affectedRows ?? userIds.length };
}

export async function bulkExportUsersCSV(userIds: number[]): Promise<string> {
  const db = await getDb();
  if (!db || userIds.length === 0) return "id,name,email,role,tier,createdAt\n";
  const rows = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    tier: users.tier,
    monthlyReviewCount: users.monthlyReviewCount,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(inArray(users.id, userIds));

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "id,name,email,role,tier,monthlyReviewCount,createdAt,lastSignedIn";
  const lines = rows.map(r =>
    `${r.id},${esc(r.name)},${esc(r.email)},${r.role},${r.tier},${r.monthlyReviewCount},${r.createdAt?.toISOString() ?? ""},${r.lastSignedIn?.toISOString() ?? ""}`
  );
  return [header, ...lines].join("\n");
}

// ── Webhook Event Log (enhanced) ──

export async function getWebhookEventLog(options: {
  limit?: number;
  eventType?: string;
} = {}): Promise<Array<{
  id: number;
  eventId: string;
  eventType: string;
  processedAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  const limit = options.limit ?? 100;
  const conditions = [];
  if (options.eventType && options.eventType !== "all") {
    conditions.push(eq(processedWebhookEvents.eventType, options.eventType));
  }
  const query = db.select({
    id: processedWebhookEvents.id,
    eventId: processedWebhookEvents.eventId,
    eventType: processedWebhookEvents.eventType,
    processedAt: processedWebhookEvents.processedAt,
  }).from(processedWebhookEvents);

  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(processedWebhookEvents.processedAt)).limit(limit);
  }
  return query.orderBy(desc(processedWebhookEvents.processedAt)).limit(limit);
}

export async function getWebhookEventStats(): Promise<{
  total: number;
  last24h: number;
  byType: Array<{ eventType: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) return { total: 0, last24h: 0, byType: [] };

  const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(processedWebhookEvents);
  const total = totalResult?.count ?? 0;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [last24hResult] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(processedWebhookEvents)
    .where(sql`${processedWebhookEvents.processedAt} >= ${oneDayAgo}`);
  const last24h = last24hResult?.count ?? 0;

  const byType = await db.select({
    eventType: processedWebhookEvents.eventType,
    count: sql<number>`COUNT(*)`,
  }).from(processedWebhookEvents)
    .groupBy(processedWebhookEvents.eventType)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(20);

  return { total, last24h, byType };
}


// ── Total User Count (for signup numbering) ──
export async function getTotalUserCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(isNull(users.deletedAt));
  return result[0]?.count ?? 0;
}
