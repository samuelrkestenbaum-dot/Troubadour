CREATE TABLE `deadLetterQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalJobId` int NOT NULL,
	`jobType` varchar(50) NOT NULL,
	`userId` int NOT NULL,
	`trackId` int,
	`projectId` int,
	`payload` json,
	`errorMessage` text NOT NULL,
	`attempts` int NOT NULL,
	`processed` boolean NOT NULL DEFAULT false,
	`reprocessedJobId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `deadLetterQueue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `deadLetterQueue` ADD CONSTRAINT `deadLetterQueue_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_dlq_userId` ON `deadLetterQueue` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_dlq_processed` ON `deadLetterQueue` (`processed`);--> statement-breakpoint
CREATE INDEX `idx_dlq_jobType` ON `deadLetterQueue` (`jobType`);