ALTER TABLE `users` ADD CONSTRAINT `users_stripeCustomerId_unique` UNIQUE(`stripeCustomerId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`);--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_dependsOnJobId_jobs_id_fk` FOREIGN KEY (`dependsOnJobId`) REFERENCES `jobs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_comparedTrackId_tracks_id_fk` FOREIGN KEY (`comparedTrackId`) REFERENCES `tracks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracks` ADD CONSTRAINT `tracks_parentTrackId_tracks_id_fk` FOREIGN KEY (`parentTrackId`) REFERENCES `tracks`(`id`) ON DELETE set null ON UPDATE no action;