CREATE TABLE `projectCollaborators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`invitedUserId` int,
	`invitedEmail` varchar(320) NOT NULL,
	`collabRole` enum('viewer') NOT NULL DEFAULT 'viewer',
	`inviteToken` varchar(64) NOT NULL,
	`collabStatus` enum('pending','accepted') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectCollaborators_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectCollaborators_inviteToken_unique` UNIQUE(`inviteToken`)
);
--> statement-breakpoint
CREATE TABLE `reviewTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`focusAreas` json NOT NULL DEFAULT ('[]'),
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviewTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectCollaborators` ADD CONSTRAINT `projectCollaborators_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectCollaborators` ADD CONSTRAINT `projectCollaborators_invitedUserId_users_id_fk` FOREIGN KEY (`invitedUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewTemplates` ADD CONSTRAINT `reviewTemplates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_projectCollaborators_projectId` ON `projectCollaborators` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_projectCollaborators_invitedUserId` ON `projectCollaborators` (`invitedUserId`);--> statement-breakpoint
CREATE INDEX `idx_reviewTemplates_userId` ON `reviewTemplates` (`userId`);