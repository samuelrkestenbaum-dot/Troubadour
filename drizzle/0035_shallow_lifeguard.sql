CREATE TABLE `actionModeCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`userId` int NOT NULL,
	`mode` varchar(50) NOT NULL,
	`content` mediumtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actionModeCache_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_actionModeCache_reviewId_mode` UNIQUE(`reviewId`,`mode`)
);
--> statement-breakpoint
ALTER TABLE `actionModeCache` ADD CONSTRAINT `actionModeCache_reviewId_reviews_id_fk` FOREIGN KEY (`reviewId`) REFERENCES `reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `actionModeCache` ADD CONSTRAINT `actionModeCache_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_actionModeCache_reviewId` ON `actionModeCache` (`reviewId`);