CREATE TABLE `artworkConcepts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`prompt` mediumtext NOT NULL,
	`imageUrl` text,
	`moodDescription` text,
	`colorPalette` json,
	`visualStyle` varchar(255),
	`artworkStatus` enum('generating','complete','error') NOT NULL DEFAULT 'generating',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artworkConcepts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `masteringChecklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`userId` int NOT NULL,
	`itemsJson` json NOT NULL,
	`overallReadiness` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `masteringChecklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `artworkConcepts` ADD CONSTRAINT `artworkConcepts_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artworkConcepts` ADD CONSTRAINT `artworkConcepts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `masteringChecklists` ADD CONSTRAINT `masteringChecklists_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `masteringChecklists` ADD CONSTRAINT `masteringChecklists_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_artworkConcepts_projectId` ON `artworkConcepts` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_masteringChecklists_trackId` ON `masteringChecklists` (`trackId`);