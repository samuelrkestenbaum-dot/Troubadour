ALTER TABLE `chatMessages` MODIFY COLUMN `content` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `conversationMessages` MODIFY COLUMN `content` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` MODIFY COLUMN `errorMessage` mediumtext;--> statement-breakpoint
ALTER TABLE `referenceTracks` MODIFY COLUMN `comparisonResult` mediumtext;--> statement-breakpoint
ALTER TABLE `reviews` MODIFY COLUMN `reviewMarkdown` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` MODIFY COLUMN `quickTake` mediumtext;