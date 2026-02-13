ALTER TABLE `users` MODIFY COLUMN `tier` enum('free','artist','pro') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(255);