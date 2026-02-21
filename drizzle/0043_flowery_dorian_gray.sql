ALTER TABLE `reviews` ADD `versionNote` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `preferredReviewLength` enum('brief','standard','detailed') DEFAULT 'standard' NOT NULL;