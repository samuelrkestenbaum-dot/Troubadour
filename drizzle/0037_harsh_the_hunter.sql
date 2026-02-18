CREATE TABLE `adminSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adminSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_adminSettings_user_key` UNIQUE(`adminUserId`,`settingKey`)
);
--> statement-breakpoint
ALTER TABLE `adminSettings` ADD CONSTRAINT `adminSettings_adminUserId_users_id_fk` FOREIGN KEY (`adminUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_adminSettings_adminUserId` ON `adminSettings` (`adminUserId`);