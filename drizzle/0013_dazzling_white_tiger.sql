CREATE TABLE `processedWebhookEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processedWebhookEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `processedWebhookEvents_eventId_unique` UNIQUE(`eventId`),
	CONSTRAINT `uq_processedWebhookEvents_eventId` UNIQUE(`eventId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `monthlyReviewCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `monthlyResetAt` timestamp DEFAULT (now()) NOT NULL;