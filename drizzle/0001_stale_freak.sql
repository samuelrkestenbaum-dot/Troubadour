CREATE TABLE `audioFeatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`featuresJson` json,
	`energyCurveJson` json,
	`sectionsJson` json,
	`geminiAnalysisJson` json,
	`analysisVersion` varchar(20) NOT NULL DEFAULT '1.0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audioFeatures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`trackId` int,
	`userId` int NOT NULL,
	`type` enum('analyze','review','album_review','compare') NOT NULL,
	`status` enum('queued','running','done','error') NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`progressMessage` varchar(500),
	`errorMessage` text,
	`resultId` int,
	`notificationSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lyrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`lyricsText` text NOT NULL,
	`source` enum('user','transcribed') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lyrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('single','album') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`intentNotes` text,
	`genre` varchar(100),
	`referenceArtists` text,
	`albumConcept` text,
	`targetVibe` varchar(255),
	`status` enum('draft','processing','reviewed','error') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`trackId` int,
	`userId` int NOT NULL,
	`reviewType` enum('track','album','comparison') NOT NULL,
	`modelUsed` varchar(100) NOT NULL,
	`promptVersion` varchar(20) NOT NULL DEFAULT '1.0',
	`reviewMarkdown` text NOT NULL,
	`scoresJson` json,
	`quickTake` text,
	`comparedTrackId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`filename` varchar(500) NOT NULL,
	`originalFilename` varchar(500) NOT NULL,
	`storageUrl` text NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` bigint NOT NULL,
	`duration` int,
	`trackOrder` int NOT NULL DEFAULT 0,
	`versionNumber` int NOT NULL DEFAULT 1,
	`parentTrackId` int,
	`status` enum('uploaded','analyzing','analyzed','reviewing','reviewed','error') NOT NULL DEFAULT 'uploaded',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `audioMinutesUsed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `audioMinutesLimit` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tier` enum('free','pro') DEFAULT 'free' NOT NULL;