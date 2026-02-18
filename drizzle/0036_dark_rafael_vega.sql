CREATE TABLE `adminAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`targetUserId` int,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `adminAuditLog` ADD CONSTRAINT `adminAuditLog_adminUserId_users_id_fk` FOREIGN KEY (`adminUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_auditLog_adminUserId` ON `adminAuditLog` (`adminUserId`);--> statement-breakpoint
CREATE INDEX `idx_auditLog_action` ON `adminAuditLog` (`action`);--> statement-breakpoint
CREATE INDEX `idx_auditLog_createdAt` ON `adminAuditLog` (`createdAt`);