CREATE TABLE `cancellationSurveys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reason` varchar(50) NOT NULL,
	`feedbackText` text,
	`offeredDiscount` boolean NOT NULL DEFAULT false,
	`acceptedDiscount` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cancellationSurveys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `emailBounced` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailBouncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailBounceReason` varchar(255);--> statement-breakpoint
ALTER TABLE `cancellationSurveys` ADD CONSTRAINT `cancellationSurveys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_cancelSurvey_userId` ON `cancellationSurveys` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_cancelSurvey_reason` ON `cancellationSurveys` (`reason`);