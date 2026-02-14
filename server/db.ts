import { eq, and, desc, asc, sql, count, avg, isNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, tracks, lyrics, audioFeatures, reviews, jobs, conversationMessages, referenceTracks, chatSessions, chatMessages, processedWebhookEvents, favorites } from "../drizzle/schema";
import type { InsertProject, InsertTrack, InsertLyrics, InsertAudioFeatures, InsertReview, InsertJob, InsertConversationMessage, InsertReferenceTrack, InsertChatSession, InsertChatMessage } from "../drizzle/schema";
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

export async function setReviewShareToken(reviewId: number, token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviews).set({ shareToken: token }).where(eq(reviews.id, reviewId));
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
