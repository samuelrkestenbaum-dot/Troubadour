CREATE TABLE `mixReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`userId` int NOT NULL,
	`reportMarkdown` mediumtext NOT NULL,
	`frequencyAnalysis` json,
	`dynamicsAnalysis` json,
	`stereoAnalysis` json,
	`loudnessData` json,
	`dawSuggestions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mixReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `structureAnalyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`sectionsJson` json,
	`structureScore` int,
	`genreExpectations` json,
	`suggestions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `structureAnalyses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_structureAnalyses_trackId` UNIQUE(`trackId`)
);
--> statement-breakpoint
CREATE TABLE `waveformAnnotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`userId` int NOT NULL,
	`timestampMs` int NOT NULL,
	`content` text NOT NULL,
	`resolved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waveformAnnotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mixReports` ADD CONSTRAINT `mixReports_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mixReports` ADD CONSTRAINT `mixReports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `structureAnalyses` ADD CONSTRAINT `structureAnalyses_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `waveformAnnotations` ADD CONSTRAINT `waveformAnnotations_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `waveformAnnotations` ADD CONSTRAINT `waveformAnnotations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_mixReports_trackId` ON `mixReports` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_waveformAnnotations_trackId` ON `waveformAnnotations` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_waveformAnnotations_userId` ON `waveformAnnotations` (`userId`);