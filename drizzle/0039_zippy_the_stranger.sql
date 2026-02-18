CREATE TABLE `artistArchetypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`archetypeJson` json NOT NULL,
	`clusterLabel` varchar(100) NOT NULL,
	`confidence` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artistArchetypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_artistArch_userId` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `artistDNA` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dnaJson` json NOT NULL,
	`trackCount` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artistDNA_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `genreBenchmarkStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`genre` varchar(100) NOT NULL,
	`focusMode` varchar(50) NOT NULL,
	`dimension` varchar(100) NOT NULL,
	`p25` int NOT NULL,
	`p50` int NOT NULL,
	`p75` int NOT NULL,
	`p90` int NOT NULL,
	`mean` int NOT NULL,
	`sampleSize` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `genreBenchmarkStats_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_genreBench_genre_focus_dim` UNIQUE(`genre`,`focusMode`,`dimension`)
);
--> statement-breakpoint
CREATE TABLE `genreClusters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`genre` varchar(100) NOT NULL,
	`subgenre` varchar(100),
	`archetypeJson` json NOT NULL,
	`sampleSize` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `genreClusters_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_genreClusters_genre_sub` UNIQUE(`genre`,`subgenre`)
);
--> statement-breakpoint
CREATE TABLE `releaseReadiness` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`userId` int NOT NULL,
	`overallSignal` enum('green','yellow','red') NOT NULL,
	`overallScore` int NOT NULL,
	`dimensionSignals` json NOT NULL,
	`blockers` json NOT NULL,
	`analysisJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `releaseReadiness_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skillProgression` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`trackId` int NOT NULL,
	`reviewId` int NOT NULL,
	`focusMode` varchar(50) NOT NULL,
	`dimension` varchar(100) NOT NULL,
	`score` int NOT NULL,
	`genre` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skillProgression_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userStreaks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currentStreak` int NOT NULL DEFAULT 0,
	`longestStreak` int NOT NULL DEFAULT 0,
	`lastActivityDate` varchar(10),
	`totalUploads` int NOT NULL DEFAULT 0,
	`totalReviews` int NOT NULL DEFAULT 0,
	`weeklyUploadGoal` int NOT NULL DEFAULT 2,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userStreaks_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_userStreaks_userId` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `artistArchetypes` ADD CONSTRAINT `artistArchetypes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artistDNA` ADD CONSTRAINT `artistDNA_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `releaseReadiness` ADD CONSTRAINT `releaseReadiness_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `releaseReadiness` ADD CONSTRAINT `releaseReadiness_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skillProgression` ADD CONSTRAINT `skillProgression_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skillProgression` ADD CONSTRAINT `skillProgression_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skillProgression` ADD CONSTRAINT `skillProgression_reviewId_reviews_id_fk` FOREIGN KEY (`reviewId`) REFERENCES `reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userStreaks` ADD CONSTRAINT `userStreaks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_artistDNA_userId` ON `artistDNA` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_genreBench_genre` ON `genreBenchmarkStats` (`genre`);--> statement-breakpoint
CREATE INDEX `idx_genreClusters_genre` ON `genreClusters` (`genre`);--> statement-breakpoint
CREATE INDEX `idx_releaseReady_trackId` ON `releaseReadiness` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_releaseReady_userId` ON `releaseReadiness` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_skillProg_userId` ON `skillProgression` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_skillProg_userId_dimension` ON `skillProgression` (`userId`,`dimension`);--> statement-breakpoint
CREATE INDEX `idx_skillProg_userId_focusMode` ON `skillProgression` (`userId`,`focusMode`);--> statement-breakpoint
CREATE INDEX `idx_skillProg_createdAt` ON `skillProgression` (`createdAt`);