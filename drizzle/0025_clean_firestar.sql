CREATE TABLE `reviewComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`parentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviewComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectCollaborators` MODIFY COLUMN `collabRole` enum('viewer','commenter') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE `reviewComments` ADD CONSTRAINT `reviewComments_reviewId_reviews_id_fk` FOREIGN KEY (`reviewId`) REFERENCES `reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewComments` ADD CONSTRAINT `reviewComments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_reviewComments_reviewId` ON `reviewComments` (`reviewId`);--> statement-breakpoint
CREATE INDEX `idx_reviewComments_userId` ON `reviewComments` (`userId`);