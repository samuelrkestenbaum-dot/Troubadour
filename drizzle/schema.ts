import { int, mysqlEnum, mysqlTable, text, mediumtext, timestamp, varchar, json, bigint, boolean, type AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { index, uniqueIndex } from "drizzle-orm/mysql-core";
import { foreignKey } from "drizzle-orm/mysql-core";
import { unique } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  audioMinutesUsed: int("audioMinutesUsed").default(0).notNull(),
  audioMinutesLimit: int("audioMinutesLimit").default(60).notNull(),
  tier: mysqlEnum("tier", ["free", "artist", "pro"]).default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).unique(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).unique(),
  monthlyReviewCount: int("monthlyReviewCount").default(0).notNull(),
  monthlyResetAt: timestamp("monthlyResetAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["single", "album"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  intentNotes: text("intentNotes"),
  genre: varchar("genre", { length: 100 }),
  referenceArtists: text("referenceArtists"),
  albumConcept: text("albumConcept"),
  targetVibe: varchar("targetVibe", { length: 255 }),
  reviewFocus: mysqlEnum("reviewFocus", ["songwriter", "producer", "arranger", "artist", "anr", "full"]).default("full").notNull(),
  status: mysqlEnum("status", ["draft", "processing", "reviewed", "error"]).default("draft").notNull(),
  coverImageUrl: varchar("coverImageUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_projects_userId").on(t.userId),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export const tracks = mysqlTable("tracks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  filename: varchar("filename", { length: 500 }).notNull(),
  originalFilename: varchar("originalFilename", { length: 500 }).notNull(),
  storageUrl: text("storageUrl").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }).notNull(),
  duration: int("duration"),
  trackOrder: int("trackOrder").default(0).notNull(),
  versionNumber: int("versionNumber").default(1).notNull(),
  parentTrackId: int("parentTrackId").references((): AnyMySqlColumn => tracks.id, { onDelete: "set null" }),
  detectedGenre: varchar("detectedGenre", { length: 255 }),
  detectedSubgenres: text("detectedSubgenres"),
  detectedInfluences: text("detectedInfluences"),
  tags: text("tags"),
  status: mysqlEnum("status", ["uploaded", "analyzing", "analyzed", "reviewing", "reviewed", "error"]).default("uploaded").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_tracks_projectId").on(t.projectId),
  index("idx_tracks_userId").on(t.userId),
  index("idx_tracks_parentTrackId").on(t.parentTrackId),
  index("idx_tracks_projectId_trackOrder").on(t.projectId, t.trackOrder),
  foreignKey({ columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),

]);

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = typeof tracks.$inferInsert;

export const lyrics = mysqlTable("lyrics", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  text: text("lyricsText").notNull(),
  source: mysqlEnum("source", ["user", "transcribed"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_lyrics_trackId").on(t.trackId),
  unique("uq_lyrics_trackId_source").on(t.trackId, t.source),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
]);

export type Lyrics = typeof lyrics.$inferSelect;
export type InsertLyrics = typeof lyrics.$inferInsert;

export const audioFeatures = mysqlTable("audioFeatures", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  featuresJson: json("featuresJson"),
  energyCurveJson: json("energyCurveJson"),
  sectionsJson: json("sectionsJson"),
  geminiAnalysisJson: json("geminiAnalysisJson"),
  analysisVersion: varchar("analysisVersion", { length: 20 }).default("1.0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_audioFeatures_trackId").on(t.trackId),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
]);

export type AudioFeatures = typeof audioFeatures.$inferSelect;
export type InsertAudioFeatures = typeof audioFeatures.$inferInsert;

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  trackId: int("trackId"),
  userId: int("userId").notNull(),
  reviewType: mysqlEnum("reviewType", ["track", "album", "comparison"]).notNull(),
  modelUsed: varchar("modelUsed", { length: 100 }).notNull(),
  promptVersion: varchar("promptVersion", { length: 20 }).default("1.0").notNull(),
  reviewMarkdown: mediumtext("reviewMarkdown").notNull(),
  scoresJson: json("scoresJson"),
  quickTake: mediumtext("quickTake"),
  comparedTrackId: int("comparedTrackId"),
  shareToken: varchar("shareToken", { length: 64 }),
  reviewVersion: int("reviewVersion").default(1).notNull(),
  isLatest: boolean("isLatest").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_reviews_projectId").on(t.projectId),
  index("idx_reviews_trackId").on(t.trackId),
  index("idx_reviews_userId").on(t.userId),
  index("idx_reviews_trackId_reviewType_isLatest").on(t.trackId, t.reviewType, t.isLatest),
  uniqueIndex("uq_reviews_shareToken").on(t.shareToken),
  foreignKey({ columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.comparedTrackId], foreignColumns: [tracks.id] }).onDelete("set null"),
]);

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  trackId: int("trackId"),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["analyze", "review", "album_review", "compare"]).notNull(),
  status: mysqlEnum("status", ["queued", "running", "done", "error"]).default("queued").notNull(),
  progress: int("progress").default(0).notNull(),
  progressMessage: varchar("progressMessage", { length: 500 }),
  errorMessage: mediumtext("errorMessage"),
  resultId: int("resultId"),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  batchId: varchar("batchId", { length: 64 }),
  heartbeatAt: timestamp("heartbeatAt"),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  attempts: int("attempts").default(0).notNull(),
  metadata: json("metadata"),
  dependsOnJobId: int("dependsOnJobId").references((): AnyMySqlColumn => jobs.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (t) => [
  index("idx_jobs_status_createdAt").on(t.status, t.createdAt),
  index("idx_jobs_projectId").on(t.projectId),
  index("idx_jobs_trackId").on(t.trackId),
  index("idx_jobs_batchId").on(t.batchId),
  index("idx_jobs_userId").on(t.userId),
  index("idx_jobs_dependsOnJobId").on(t.dependsOnJobId),
  foreignKey({ columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),

]);

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ── Follow-up Conversations ──

export const conversationMessages = mysqlTable("conversationMessages", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: mediumtext("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_conversationMessages_reviewId").on(t.reviewId),
  foreignKey({ columns: [t.reviewId], foreignColumns: [reviews.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;

// ── Reference Tracks ──

export const referenceTracks = mysqlTable("referenceTracks", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  userId: int("userId").notNull(),
  filename: varchar("filename", { length: 500 }).notNull(),
  originalFilename: varchar("originalFilename", { length: 500 }).notNull(),
  storageUrl: text("storageUrl").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }).notNull(),
  comparisonResult: mediumtext("comparisonResult"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_referenceTracks_trackId").on(t.trackId),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type ReferenceTrack = typeof referenceTracks.$inferSelect;
export type InsertReferenceTrack = typeof referenceTracks.$inferInsert;

// ── Chat Sessions (persistent sidebar chatbot) ──

export const chatSessions = mysqlTable("chatSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  trackId: int("trackId"),
  title: varchar("title", { length: 255 }).default("New conversation").notNull(),
  lastActiveAt: timestamp("lastActiveAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_chatSessions_userId").on(t.userId),
  index("idx_chatSessions_projectId").on(t.projectId),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: mediumtext("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_chatMessages_sessionId_createdAt").on(t.sessionId, t.createdAt),
  foreignKey({ columns: [t.sessionId], foreignColumns: [chatSessions.id] }).onDelete("cascade"),
]);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ── Favorites ──

export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trackId: int("trackId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_favorites_userId_trackId").on(t.userId, t.trackId),
  index("idx_favorites_userId").on(t.userId),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
]);

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

// ── Webhook Idempotency ──

export const processedWebhookEvents = mysqlTable("processedWebhookEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 255 }).notNull().unique(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_processedWebhookEvents_eventId").on(t.eventId),
]);


// ── Review Templates ──

export const reviewTemplates = mysqlTable("reviewTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  focusAreas: json("focusAreas").$type<string[]>().notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_reviewTemplates_userId").on(t.userId),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type ReviewTemplate = typeof reviewTemplates.$inferSelect;
export type InsertReviewTemplate = typeof reviewTemplates.$inferInsert;

// ── Project Collaborators ──

export const projectCollaborators = mysqlTable("projectCollaborators", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  invitedUserId: int("invitedUserId"),
  invitedEmail: varchar("invitedEmail", { length: 320 }).notNull(),
  role: mysqlEnum("collabRole", ["viewer"]).default("viewer").notNull(),
  inviteToken: varchar("inviteToken", { length: 64 }).notNull().unique(),
  status: mysqlEnum("collabStatus", ["pending", "accepted"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_projectCollaborators_projectId").on(t.projectId),
  index("idx_projectCollaborators_invitedUserId").on(t.invitedUserId),
  foreignKey({ columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.invitedUserId], foreignColumns: [users.id] }).onDelete("set null"),
]);

export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type InsertProjectCollaborator = typeof projectCollaborators.$inferInsert;
