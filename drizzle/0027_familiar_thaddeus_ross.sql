CREATE TABLE `trackNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`userId` int NOT NULL,
	`content` mediumtext NOT NULL,
	`pinned` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trackNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trackNotes` ADD CONSTRAINT `trackNotes_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trackNotes` ADD CONSTRAINT `trackNotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_trackNotes_trackId` ON `trackNotes` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_trackNotes_userId` ON `trackNotes` (`userId`);