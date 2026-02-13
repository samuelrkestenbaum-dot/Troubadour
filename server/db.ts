import { eq, and, desc, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, tracks, lyrics, audioFeatures, reviews, jobs, conversationMessages, referenceTracks, chatSessions, chatMessages } from "../drizzle/schema";
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

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
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
  await db.delete(jobs).where(eq(jobs.projectId, id));
  await db.delete(reviews).where(eq(reviews.projectId, id));
  const projectTracks = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.projectId, id));
  for (const t of projectTracks) {
    await db.delete(audioFeatures).where(eq(audioFeatures.trackId, t.id));
    await db.delete(lyrics).where(eq(lyrics.trackId, t.id));
  }
  await db.delete(tracks).where(eq(tracks.projectId, id));
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

export async function getTrackVersions(parentTrackId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tracks).where(eq(tracks.parentTrackId, parentTrackId)).orderBy(asc(tracks.versionNumber));
}

// ── Lyrics helpers ──

export async function upsertLyrics(trackId: number, lyricsText: string, source: "user" | "transcribed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(lyrics).where(and(eq(lyrics.trackId, trackId), eq(lyrics.source, source))).limit(1);
  if (existing.length > 0) {
    await db.update(lyrics).set({ text: lyricsText }).where(eq(lyrics.id, existing[0].id));
    return { id: existing[0].id };
  }
  const result = await db.insert(lyrics).values({ trackId, text: lyricsText, source });
  return { id: result[0].insertId };
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

export async function updateJob(id: number, data: Partial<InsertJob>) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set(data).where(eq(jobs.id, id));
}

export async function getActiveJobForTrack(trackId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs)
    .where(and(eq(jobs.trackId, trackId), sql`${jobs.status} IN ('queued', 'running')`))
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
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, id));
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
