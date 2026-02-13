CREATE TABLE `conversationMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversationMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referenceTracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`userId` int NOT NULL,
	`filename` varchar(500) NOT NULL,
	`originalFilename` varchar(500) NOT NULL,
	`storageUrl` text NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` bigint NOT NULL,
	`comparisonResult` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referenceTracks_id` PRIMARY KEY(`id`)
);
