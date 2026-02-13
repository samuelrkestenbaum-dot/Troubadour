import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  audioMinutesUsed: int("audioMinutesUsed").default(0).notNull(),
  audioMinutesLimit: int("audioMinutesLimit").default(60).notNull(),
  tier: mysqlEnum("tier", ["free", "pro"]).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  parentTrackId: int("parentTrackId"),
  status: mysqlEnum("status", ["uploaded", "analyzing", "analyzed", "reviewing", "reviewed", "error"]).default("uploaded").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = typeof tracks.$inferInsert;

export const lyrics = mysqlTable("lyrics", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  text: text("lyricsText").notNull(),
  source: mysqlEnum("source", ["user", "transcribed"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
});

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
  reviewMarkdown: text("reviewMarkdown").notNull(),
  scoresJson: json("scoresJson"),
  quickTake: text("quickTake"),
  comparedTrackId: int("comparedTrackId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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
  errorMessage: text("errorMessage"),
  resultId: int("resultId"),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;
