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
  digestFrequency: mysqlEnum("digestFrequency", ["weekly", "biweekly", "monthly", "disabled"]).default("weekly").notNull(),
  lastDigestSentAt: timestamp("lastDigestSentAt"),
  preferredPersona: mysqlEnum("preferredPersona", ["songwriter", "producer", "arranger", "artist", "anr", "full"]).default("full").notNull(),
  notificationPreferences: json("notificationPreferences").$type<{
    review_complete: boolean;
    collaboration_invite: boolean;
    collaboration_accepted: boolean;
    digest: boolean;
    payment_failed: boolean;
    system: boolean;
  }>(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
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
  shareExpiresAt: timestamp("shareExpiresAt"),
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
  retryAfter: timestamp("retryAfter"),
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
  systemPrompt: text("systemPrompt"),
  icon: varchar("icon", { length: 50 }),
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
  role: mysqlEnum("collabRole", ["viewer", "commenter"]).default("viewer").notNull(),
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

// ── Review Comments ──

export const reviewComments = mysqlTable("reviewComments", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  parentId: int("parentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_reviewComments_reviewId").on(t.reviewId),
  index("idx_reviewComments_userId").on(t.userId),
  foreignKey({ columns: [t.reviewId], foreignColumns: [reviews.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type ReviewComment = typeof reviewComments.$inferSelect;
export type InsertReviewComment = typeof reviewComments.$inferInsert;

// ── Waveform Annotations ──

export const waveformAnnotations = mysqlTable("waveformAnnotations", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  userId: int("userId").notNull(),
  timestampMs: int("timestampMs").notNull(),
  content: text("content").notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_waveformAnnotations_trackId").on(t.trackId),
  index("idx_waveformAnnotations_userId").on(t.userId),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type WaveformAnnotation = typeof waveformAnnotations.$inferSelect;
export type InsertWaveformAnnotation = typeof waveformAnnotations.$inferInsert;

// ── Mix Reports (cached technical analysis) ──

export const mixReports = mysqlTable("mixReports", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  userId: int("userId").notNull(),
  reportMarkdown: mediumtext("reportMarkdown").notNull(),
  frequencyAnalysis: json("frequencyAnalysis"),
  dynamicsAnalysis: json("dynamicsAnalysis"),
  stereoAnalysis: json("stereoAnalysis"),
  loudnessData: json("loudnessData"),
  dawSuggestions: json("dawSuggestions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_mixReports_trackId").on(t.trackId),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type MixReport = typeof mixReports.$inferSelect;
export type InsertMixReport = typeof mixReports.$inferInsert;

// ── Structure Analysis (cached song structure) ──

export const structureAnalyses = mysqlTable("structureAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  sectionsJson: json("sectionsJson"),
  structureScore: int("structureScore"),
  genreExpectations: json("genreExpectations"),
  suggestions: json("suggestions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_structureAnalyses_trackId").on(t.trackId),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
]);

export type StructureAnalysis = typeof structureAnalyses.$inferSelect;
export type InsertStructureAnalysis = typeof structureAnalyses.$inferInsert;

// ── Project Insights (AI-generated project-level summary) ──

export const projectInsights = mysqlTable("projectInsights", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  summaryMarkdown: mediumtext("summaryMarkdown").notNull(),
  strengthsJson: json("strengthsJson").$type<string[]>(),
  weaknessesJson: json("weaknessesJson").$type<string[]>(),
  recommendationsJson: json("recommendationsJson").$type<string[]>(),
  averageScoresJson: json("averageScoresJson").$type<Record<string, number>>(),
  trackCount: int("trackCount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_projectInsights_projectId").on(t.projectId),
  foreignKey({ columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type ProjectInsight = typeof projectInsights.$inferSelect;
export type InsertProjectInsight = typeof projectInsights.$inferInsert;


// ── Notifications ──

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["review_complete", "collaboration_invite", "collaboration_accepted", "system", "digest", "payment_failed"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  link: varchar("link", { length: 500 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_notifications_userId").on(t.userId),
  index("idx_notifications_userId_isRead").on(t.userId, t.isRead),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ── Artwork Concepts ──

export const artworkConcepts = mysqlTable("artworkConcepts", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  prompt: mediumtext("prompt").notNull(),
  imageUrl: text("imageUrl"),
  moodDescription: text("moodDescription"),
  colorPalette: json("colorPalette").$type<string[]>(),
  visualStyle: varchar("visualStyle", { length: 255 }),
  status: mysqlEnum("artworkStatus", ["generating", "complete", "error"]).default("generating").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_artworkConcepts_projectId").on(t.projectId),
  foreignKey({ columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type ArtworkConcept = typeof artworkConcepts.$inferSelect;
export type InsertArtworkConcept = typeof artworkConcepts.$inferInsert;

// ── Mastering Checklists ──

export const masteringChecklists = mysqlTable("masteringChecklists", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  userId: int("userId").notNull(),
  itemsJson: json("itemsJson").$type<Array<{ id: string; category: string; issue: string; suggestion: string; priority: "high" | "medium" | "low"; completed: boolean }>>().notNull(),
  overallReadiness: int("overallReadiness").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_masteringChecklists_trackId").on(t.trackId),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type MasteringChecklist = typeof masteringChecklists.$inferSelect;
export type InsertMasteringChecklist = typeof masteringChecklists.$inferInsert;

// ── Track Notes / Journal ──

export const trackNotes = mysqlTable("trackNotes", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  userId: int("userId").notNull(),
  content: mediumtext("content").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_trackNotes_trackId").on(t.trackId),
  index("idx_trackNotes_userId").on(t.userId),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type TrackNote = typeof trackNotes.$inferSelect;
export type InsertTrackNote = typeof trackNotes.$inferInsert;


// ── Action Mode Cache ──

export const actionModeCache = mysqlTable("actionModeCache", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  userId: int("userId").notNull(),
  mode: varchar("mode", { length: 50 }).notNull(),
  content: mediumtext("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_actionModeCache_reviewId_mode").on(t.reviewId, t.mode),
  index("idx_actionModeCache_reviewId").on(t.reviewId),
  foreignKey({ columns: [t.reviewId], foreignColumns: [reviews.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);

export type ActionModeCache = typeof actionModeCache.$inferSelect;
export type InsertActionModeCache = typeof actionModeCache.$inferInsert;

// ── Admin Audit Log ──
export const adminAuditLog = mysqlTable("adminAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetUserId: int("targetUserId"),
  details: json("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_auditLog_adminUserId").on(t.adminUserId),
  index("idx_auditLog_action").on(t.action),
  index("idx_auditLog_createdAt").on(t.createdAt),
  foreignKey({ columns: [t.adminUserId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

// ── Admin Settings ──
export const adminSettings = mysqlTable("adminSettings", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  settingKey: varchar("settingKey", { length: 100 }).notNull(),
  settingValue: json("settingValue").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("uq_adminSettings_user_key").on(t.adminUserId, t.settingKey),
  index("idx_adminSettings_adminUserId").on(t.adminUserId),
  foreignKey({ columns: [t.adminUserId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = typeof adminSettings.$inferInsert;

// ── Instrumentation Advice (persisted) ──
export const instrumentationAdvice = mysqlTable("instrumentationAdvice", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  userId: int("userId").notNull(),
  targetState: varchar("targetState", { length: 50 }).notNull(),
  adviceJson: json("adviceJson").$type<Record<string, unknown>>().notNull(),
  artistNotes: text("artistNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_instrAdvice_trackId").on(t.trackId),
  index("idx_instrAdvice_userId").on(t.userId),
  index("idx_instrAdvice_trackId_target").on(t.trackId, t.targetState),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type InstrumentationAdviceRow = typeof instrumentationAdvice.$inferSelect;
export type InsertInstrumentationAdvice = typeof instrumentationAdvice.$inferInsert;

// ── Signature Sound (album-level unifying elements) ──
export const signatureSound = mysqlTable("signatureSound", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  adviceJson: json("adviceJson").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_sigSound_projectId").on(t.projectId),
  index("idx_sigSound_userId").on(t.userId),
  foreignKey({ columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type SignatureSoundRow = typeof signatureSound.$inferSelect;
export type InsertSignatureSound = typeof signatureSound.$inferInsert;

// ── Skill Progression (Feature 1: Longitudinal Improvement Tracking) ──
export const skillProgression = mysqlTable("skillProgression", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trackId: int("trackId").notNull(),
  reviewId: int("reviewId").notNull(),
  focusMode: varchar("focusMode", { length: 50 }).notNull(),
  dimension: varchar("dimension", { length: 100 }).notNull(),
  score: int("score").notNull(),
  genre: varchar("genre", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_skillProg_userId").on(t.userId),
  index("idx_skillProg_userId_dimension").on(t.userId, t.dimension),
  index("idx_skillProg_userId_focusMode").on(t.userId, t.focusMode),
  index("idx_skillProg_createdAt").on(t.createdAt),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.reviewId], foreignColumns: [reviews.id] }).onDelete("cascade"),
]);
export type SkillProgressionRow = typeof skillProgression.$inferSelect;
export type InsertSkillProgression = typeof skillProgression.$inferInsert;

// ── Genre Benchmark Stats (Feature 2: Competitive Benchmarking) ──
export const genreBenchmarkStats = mysqlTable("genreBenchmarkStats", {
  id: int("id").autoincrement().primaryKey(),
  genre: varchar("genre", { length: 100 }).notNull(),
  focusMode: varchar("focusMode", { length: 50 }).notNull(),
  dimension: varchar("dimension", { length: 100 }).notNull(),
  p25: int("p25").notNull(),
  p50: int("p50").notNull(),
  p75: int("p75").notNull(),
  p90: int("p90").notNull(),
  mean: int("mean").notNull(),
  sampleSize: int("sampleSize").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("uq_genreBench_genre_focus_dim").on(t.genre, t.focusMode, t.dimension),
  index("idx_genreBench_genre").on(t.genre),
]);
export type GenreBenchmarkStatsRow = typeof genreBenchmarkStats.$inferSelect;
export type InsertGenreBenchmarkStats = typeof genreBenchmarkStats.$inferInsert;

// ── Release Readiness (Feature 3: Release Readiness Scoring) ──
export const releaseReadiness = mysqlTable("releaseReadiness", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  userId: int("userId").notNull(),
  overallSignal: mysqlEnum("overallSignal", ["green", "yellow", "red"]).notNull(),
  overallScore: int("overallScore").notNull(),
  dimensionSignals: json("dimensionSignals").$type<Record<string, { signal: string; score: number; reason: string }>>().notNull(),
  blockers: json("blockers").$type<Array<{ dimension: string; severity: string; description: string; fix: string }>>().notNull(),
  analysisJson: json("analysisJson").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_releaseReady_trackId").on(t.trackId),
  index("idx_releaseReady_userId").on(t.userId),
  foreignKey({ columns: [t.trackId], foreignColumns: [tracks.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type ReleaseReadinessRow = typeof releaseReadiness.$inferSelect;
export type InsertReleaseReadiness = typeof releaseReadiness.$inferInsert;

// ── User Streaks (Feature 4: Behavioral Retention Engine) ──
export const userStreaks = mysqlTable("userStreaks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  currentStreak: int("currentStreak").default(0).notNull(),
  longestStreak: int("longestStreak").default(0).notNull(),
  lastActivityDate: varchar("lastActivityDate", { length: 10 }), // YYYY-MM-DD
  totalUploads: int("totalUploads").default(0).notNull(),
  totalReviews: int("totalReviews").default(0).notNull(),
  weeklyUploadGoal: int("weeklyUploadGoal").default(2).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("uq_userStreaks_userId").on(t.userId),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type UserStreakRow = typeof userStreaks.$inferSelect;
export type InsertUserStreak = typeof userStreaks.$inferInsert;

// ── Artist DNA (Feature 5: Artist DNA Identity Model) ──
export const artistDNA = mysqlTable("artistDNA", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  dnaJson: json("dnaJson").$type<Record<string, unknown>>().notNull(),
  trackCount: int("trackCount").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_artistDNA_userId").on(t.userId),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type ArtistDNARow = typeof artistDNA.$inferSelect;
export type InsertArtistDNA = typeof artistDNA.$inferInsert;

// ── Genre Clusters (Feature 6: Data Flywheel) ──
export const genreClusters = mysqlTable("genreClusters", {
  id: int("id").autoincrement().primaryKey(),
  genre: varchar("genre", { length: 100 }).notNull(),
  subgenre: varchar("subgenre", { length: 100 }),
  archetypeJson: json("archetypeJson").$type<Record<string, unknown>>().notNull(),
  sampleSize: int("sampleSize").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("uq_genreClusters_genre_sub").on(t.genre, t.subgenre),
  index("idx_genreClusters_genre").on(t.genre),
]);
export type GenreClusterRow = typeof genreClusters.$inferSelect;
export type InsertGenreCluster = typeof genreClusters.$inferInsert;

// ── Artist Archetypes (Feature 6: Data Flywheel) ──
export const artistArchetypes = mysqlTable("artistArchetypes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  archetypeJson: json("archetypeJson").$type<Record<string, unknown>>().notNull(),
  clusterLabel: varchar("clusterLabel", { length: 100 }).notNull(),
  confidence: int("confidence").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("uq_artistArch_userId").on(t.userId),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type ArtistArchetypeRow = typeof artistArchetypes.$inferSelect;
export type InsertArtistArchetype = typeof artistArchetypes.$inferInsert;

// ── Email Verification Tokens ──
export const emailVerificationTokens = mysqlTable("emailVerificationTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_emailVerToken_userId").on(t.userId),
  index("idx_emailVerToken_token").on(t.token),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type EmailVerificationTokenRow = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

// ── Dead Letter Queue ──
export const deadLetterQueue = mysqlTable("deadLetterQueue", {
  id: int("id").autoincrement().primaryKey(),
  originalJobId: int("originalJobId").notNull(),
  jobType: varchar("jobType", { length: 50 }).notNull(),
  userId: int("userId").notNull(),
  trackId: int("trackId"),
  projectId: int("projectId"),
  payload: json("payload").$type<Record<string, unknown>>(),
  errorMessage: text("errorMessage").notNull(),
  attempts: int("attempts").notNull(),
  processed: boolean("processed").default(false).notNull(),
  reprocessedJobId: int("reprocessedJobId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
}, (t) => [
  index("idx_dlq_userId").on(t.userId),
  index("idx_dlq_processed").on(t.processed),
  index("idx_dlq_jobType").on(t.jobType),
  foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
]);
export type DeadLetterQueueRow = typeof deadLetterQueue.$inferSelect;
export type InsertDeadLetterQueue = typeof deadLetterQueue.$inferInsert;
