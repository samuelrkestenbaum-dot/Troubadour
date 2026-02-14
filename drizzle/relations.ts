import { relations } from "drizzle-orm/relations";
import { tracks, audioFeatures, chatSessions, chatMessages, users, reviews, conversationMessages, favorites, projects, jobs, lyrics, referenceTracks } from "./schema";

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
	referenceTracks: many(referenceTracks),
	reviews: many(reviews),
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

export const usersRelations = relations(users, ({many}) => ({
	chatSessions: many(chatSessions),
	conversationMessages: many(conversationMessages),
	favorites: many(favorites),
	jobs: many(jobs),
	projects: many(projects),
	referenceTracks: many(referenceTracks),
	reviews: many(reviews),
	tracks: many(tracks),
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

export const reviewsRelations = relations(reviews, ({one, many}) => ({
	conversationMessages: many(conversationMessages),
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

export const projectsRelations = relations(projects, ({one, many}) => ({
	jobs: many(jobs),
	user: one(users, {
		fields: [projects.userId],
		references: [users.id]
	}),
	reviews: many(reviews),
	tracks: many(tracks),
}));

export const lyricsRelations = relations(lyrics, ({one}) => ({
	track: one(tracks, {
		fields: [lyrics.trackId],
		references: [tracks.id]
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