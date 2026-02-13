ALTER TABLE `reviews` ADD `reviewVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `isLatest` boolean DEFAULT true NOT NULL;