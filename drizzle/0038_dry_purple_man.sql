CREATE TABLE `instrumentationAdvice` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`userId` int NOT NULL,
	`targetState` varchar(50) NOT NULL,
	`adviceJson` json NOT NULL,
	`artistNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `instrumentationAdvice_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signatureSound` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`adviceJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signatureSound_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `instrumentationAdvice` ADD CONSTRAINT `instrumentationAdvice_trackId_tracks_id_fk` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instrumentationAdvice` ADD CONSTRAINT `instrumentationAdvice_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `signatureSound` ADD CONSTRAINT `signatureSound_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `signatureSound` ADD CONSTRAINT `signatureSound_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_instrAdvice_trackId` ON `instrumentationAdvice` (`trackId`);--> statement-breakpoint
CREATE INDEX `idx_instrAdvice_userId` ON `instrumentationAdvice` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_instrAdvice_trackId_target` ON `instrumentationAdvice` (`trackId`,`targetState`);--> statement-breakpoint
CREATE INDEX `idx_sigSound_projectId` ON `signatureSound` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_sigSound_userId` ON `signatureSound` (`userId`);