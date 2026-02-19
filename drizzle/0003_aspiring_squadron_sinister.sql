CREATE TABLE `admin_action_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actorUserId` text(255),
	`action` text(128) NOT NULL,
	`targetType` text(128) NOT NULL,
	`targetId` text(255),
	`payloadJson` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`actorUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_action_log_actor_idx` ON `admin_action_log` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `admin_action_log_action_idx` ON `admin_action_log` (`action`);--> statement-breakpoint
CREATE TABLE `user_role` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`role` text(32) NOT NULL,
	`createdByUserId` text(255),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_role_user_role_unique` ON `user_role` (`userId`,`role`);--> statement-breakpoint
CREATE INDEX `user_role_role_idx` ON `user_role` (`role`);--> statement-breakpoint
ALTER TABLE `user` ADD `isNonUser` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `app_setting` (
	`key` text(128) PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);