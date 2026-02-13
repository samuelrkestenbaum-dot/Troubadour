ALTER TABLE `jobs` ADD `heartbeatAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `maxAttempts` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `dependsOnJobId` int;--> statement-breakpoint
ALTER TABLE `audioFeatures` ADD CONSTRAINT `uq_audioFeatures_trackId` UNIQUE(`trackId`);--> statement-breakpoint
ALTER TABLE `lyrics` ADD CONSTRAINT `uq_lyrics_trackId_source` UNIQUE(`trackId`,`source`);--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `uq_reviews_shareToken` UNIQUE(`shareToken`);--> statement-breakpoint
ALTER TABLE `audioFeatures` ADD CONSTRAINT `audioFeatures_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chatMessages` ADD CONSTRAINT `chatMessages_sessionId_chatSessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `chatSessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chatSessions` ADD CONSTRAINT `chatSessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD CONSTRAINT `conversationMessages_reviewId_reviews_id_fk` FOREIGN KEY (`reviewId`) REFERENCES `reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD CONSTRAINT `conversationMessages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lyrics` ADD CONSTRAINT `lyrics_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referenceTracks` ADD CONSTRAINT `referenceTracks_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referenceTracks` ADD CONSTRAINT `referenceTracks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracks` ADD CONSTRAINT `tracks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracks` ADD CONSTRAINT `tracks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_chatMessages_sessionId_createdAt` ON `chatMessages` (`sessionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_chatSessions_userId` ON `chatSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_chatSessions_projectId` ON `chatSessions` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_conversationMessages_reviewId` ON `conversationMessages` (`reviewId`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status_createdAt` ON `jobs` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_jobs_projectId` ON `jobs` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_jobs_trackId` ON `jobs` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_jobs_batchId` ON `jobs` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_jobs_userId` ON `jobs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_jobs_dependsOnJobId` ON `jobs` (`dependsOnJobId`);--> statement-breakpoint
CREATE INDEX `idx_lyrics_trackId` ON `lyrics` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_projects_userId` ON `projects` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_referenceTracks_trackId` ON `referenceTracks` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_reviews_projectId` ON `reviews` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_reviews_trackId` ON `reviews` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_reviews_userId` ON `reviews` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_reviews_trackId_reviewType_isLatest` ON `reviews` (`trackId`,`reviewType`,`isLatest`);--> statement-breakpoint
CREATE INDEX `idx_tracks_projectId` ON `tracks` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_tracks_userId` ON `tracks` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_tracks_parentTrackId` ON `tracks` (`parentTrackId`);--> statement-breakpoint
CREATE INDEX `idx_tracks_projectId_trackOrder` ON `tracks` (`projectId`,`trackOrder`);