CREATE TABLE `projectInsights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`summaryMarkdown` mediumtext NOT NULL,
	`strengthsJson` json,
	`weaknessesJson` json,
	`recommendationsJson` json,
	`averageScoresJson` json,
	`trackCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectInsights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectInsights` ADD CONSTRAINT `projectInsights_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectInsights` ADD CONSTRAINT `projectInsights_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_projectInsights_projectId` ON `projectInsights` (`projectId`);