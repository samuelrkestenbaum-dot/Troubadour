import { relations } from "drizzle-orm/relations";
import { reviews, actionModeCache, users, adminAuditLog, projects, artworkConcepts, tracks, audioFeatures, chatSessions, chatMessages, conversationMessages, favorites, jobs, lyrics, masteringChecklists, mixReports, notifications, projectInsights, referenceTracks, reviewComments, structureAnalyses, trackNotes, waveformAnnotations } from "./schema";

export const actionModeCacheRelations = relations(actionModeCache, ({one}) => ({
	review: one(reviews, {
		fields: [actionModeCache.reviewId],
		references: [reviews.id]
	}),
	user: one(users, {
		fields: [actionModeCache.userId],
		references: [users.id]
	}),
}));

export const reviewsRelations = relations(reviews, ({one, many}) => ({
	actionModeCaches: many(actionModeCache),
	conversationMessages: many(conversationMessages),
	reviewComments: many(reviewComments),
	project: one(projects, {
		fields: [reviews.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [reviews.userId],
		references: [users.id]
	}),
	track: one(tracks, {
		fields: [reviews.comparedTrackId],
		references: [tracks.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	actionModeCaches: many(actionModeCache),
	adminAuditLogs: many(adminAuditLog),
	artworkConcepts: many(artworkConcepts),
	chatSessions: many(chatSessions),
	conversationMessages: many(conversationMessages),
	favorites: many(favorites),
	jobs: many(jobs),
	masteringChecklists: many(masteringChecklists),
	mixReports: many(mixReports),
	notifications: many(notifications),
	projectInsights: many(projectInsights),
	projects: many(projects),
	referenceTracks: many(referenceTracks),
	reviewComments: many(reviewComments),
	reviews: many(reviews),
	trackNotes: many(trackNotes),
	tracks: many(tracks),
	waveformAnnotations: many(waveformAnnotations),
}));

export const adminAuditLogRelations = relations(adminAuditLog, ({one}) => ({
	user: one(users, {
		fields: [adminAuditLog.adminUserId],
		references: [users.id]
	}),
}));

export const artworkConceptsRelations = relations(artworkConcepts, ({one}) => ({
	project: one(projects, {
		fields: [artworkConcepts.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [artworkConcepts.userId],
		references: [users.id]
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	artworkConcepts: many(artworkConcepts),
	jobs: many(jobs),
	projectInsights: many(projectInsights),
	user: one(users, {
		fields: [projects.userId],
		references: [users.id]
	}),
	reviews: many(reviews),
	tracks: many(tracks),
}));

export const audioFeaturesRelations = relations(audioFeatures, ({one}) => ({
	track: one(tracks, {
		fields: [audioFeatures.trackId],
		references: [tracks.id]
	}),
}));

export const tracksRelations = relations(tracks, ({one, many}) => ({
	audioFeatures: many(audioFeatures),
	favorites: many(favorites),
	lyrics: many(lyrics),
	masteringChecklists: many(masteringChecklists),
	mixReports: many(mixReports),
	referenceTracks: many(referenceTracks),
	reviews: many(reviews),
	structureAnalyses: many(structureAnalyses),
	trackNotes: many(trackNotes),
	project: one(projects, {
		fields: [tracks.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [tracks.userId],
		references: [users.id]
	}),
	track: one(tracks, {
		fields: [tracks.parentTrackId],
		references: [tracks.id],
		relationName: "tracks_parentTrackId_tracks_id"
	}),
	tracks: many(tracks, {
		relationName: "tracks_parentTrackId_tracks_id"
	}),
	waveformAnnotations: many(waveformAnnotations),
}));

export const chatMessagesRelations = relations(chatMessages, ({one}) => ({
	chatSession: one(chatSessions, {
		fields: [chatMessages.sessionId],
		references: [chatSessions.id]
	}),
}));

export const chatSessionsRelations = relations(chatSessions, ({one, many}) => ({
	chatMessages: many(chatMessages),
	user: one(users, {
		fields: [chatSessions.userId],
		references: [users.id]
	}),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({one}) => ({
	review: one(reviews, {
		fields: [conversationMessages.reviewId],
		references: [reviews.id]
	}),
	user: one(users, {
		fields: [conversationMessages.userId],
		references: [users.id]
	}),
}));

export const favoritesRelations = relations(favorites, ({one}) => ({
	user: one(users, {
		fields: [favorites.userId],
		references: [users.id]
	}),
	track: one(tracks, {
		fields: [favorites.trackId],
		references: [tracks.id]
	}),
}));

export const jobsRelations = relations(jobs, ({one, many}) => ({
	project: one(projects, {
		fields: [jobs.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [jobs.userId],
		references: [users.id]
	}),
	job: one(jobs, {
		fields: [jobs.dependsOnJobId],
		references: [jobs.id],
		relationName: "jobs_dependsOnJobId_jobs_id"
	}),
	jobs: many(jobs, {
		relationName: "jobs_dependsOnJobId_jobs_id"
	}),
}));

export const lyricsRelations = relations(lyrics, ({one}) => ({
	track: one(tracks, {
		fields: [lyrics.trackId],
		references: [tracks.id]
	}),
}));

export const masteringChecklistsRelations = relations(masteringChecklists, ({one}) => ({
	track: one(tracks, {
		fields: [masteringChecklists.trackId],
		references: [tracks.id]
	}),
	user: one(users, {
		fields: [masteringChecklists.userId],
		references: [users.id]
	}),
}));

export const mixReportsRelations = relations(mixReports, ({one}) => ({
	track: one(tracks, {
		fields: [mixReports.trackId],
		references: [tracks.id]
	}),
	user: one(users, {
		fields: [mixReports.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const projectInsightsRelations = relations(projectInsights, ({one}) => ({
	project: one(projects, {
		fields: [projectInsights.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [projectInsights.userId],
		references: [users.id]
	}),
}));

export const referenceTracksRelations = relations(referenceTracks, ({one}) => ({
	track: one(tracks, {
		fields: [referenceTracks.trackId],
		references: [tracks.id]
	}),
	user: one(users, {
		fields: [referenceTracks.userId],
		references: [users.id]
	}),
}));

export const reviewCommentsRelations = relations(reviewComments, ({one}) => ({
	review: one(reviews, {
		fields: [reviewComments.reviewId],
		references: [reviews.id]
	}),
	user: one(users, {
		fields: [reviewComments.userId],
		references: [users.id]
	}),
}));

export const structureAnalysesRelations = relations(structureAnalyses, ({one}) => ({
	track: one(tracks, {
		fields: [structureAnalyses.trackId],
		references: [tracks.id]
	}),
}));

export const trackNotesRelations = relations(trackNotes, ({one}) => ({
	track: one(tracks, {
		fields: [trackNotes.trackId],
		references: [tracks.id]
	}),
	user: one(users, {
		fields: [trackNotes.userId],
		references: [users.id]
	}),
}));

export const waveformAnnotationsRelations = relations(waveformAnnotations, ({one}) => ({
	track: one(tracks, {
		fields: [waveformAnnotations.trackId],
		references: [tracks.id]
	}),
	user: one(users, {
		fields: [waveformAnnotations.userId],
		references: [users.id]
	}),
}));