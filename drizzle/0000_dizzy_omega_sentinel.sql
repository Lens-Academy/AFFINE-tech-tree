CREATE TABLE `account` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`accountId` text(255) NOT NULL,
	`providerId` text(255) NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text(255),
	`idToken` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
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
CREATE TABLE `app_setting` (
	`key` text(128) PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookmark` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`topicId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_user_topic_unique` ON `bookmark` (`userId`,`topicId`);--> statement-breakpoint
CREATE TABLE `feedback_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`topicId` integer NOT NULL,
	`transitionId` integer,
	`type` text(32) NOT NULL,
	`topicLinkId` integer,
	`referencedUserId` text(255),
	`freeTextValue` text(1024),
	`helpfulnessRating` text(32),
	`comment` text(2048),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transitionId`) REFERENCES `level_transition`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`topicLinkId`) REFERENCES `topic_link`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`referencedUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `feedback_item_transition_idx` ON `feedback_item` (`transitionId`);--> statement-breakpoint
CREATE INDEX `feedback_item_user_topic_idx` ON `feedback_item` (`userId`,`topicId`);--> statement-breakpoint
CREATE TABLE `level_transition` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`topicId` integer NOT NULL,
	`fromLevel` text(64),
	`toLevel` text(64),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `level_transition_user_idx` ON `level_transition` (`userId`);--> statement-breakpoint
CREATE INDEX `level_transition_topic_idx` ON `level_transition` (`topicId`);--> statement-breakpoint
CREATE INDEX `level_transition_user_topic_idx` ON `level_transition` (`userId`,`topicId`);--> statement-breakpoint
CREATE TABLE `resource` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topicId` integer NOT NULL,
	`title` text(512) NOT NULL,
	`url` text(2048) NOT NULL,
	`type` text(64),
	`submittedById` text(255) NOT NULL,
	`approved` integer DEFAULT false,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submittedById`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resource_topic_idx` ON `resource` (`topicId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`token` text(255) NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text(255),
	`userAgent` text(255),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `tag` (
	`name` text(255) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teaching_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teacherId` text(255) NOT NULL,
	`learnerId` text(255) NOT NULL,
	`topicId` integer NOT NULL,
	`rating` integer,
	`feedback` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`teacherId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learnerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `teaching_session_teacher_idx` ON `teaching_session` (`teacherId`);--> statement-breakpoint
CREATE INDEX `teaching_session_learner_idx` ON `teaching_session` (`learnerId`);--> statement-breakpoint
CREATE INDEX `teaching_session_topic_idx` ON `teaching_session` (`topicId`);--> statement-breakpoint
CREATE TABLE `topic` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(512) NOT NULL,
	`description` text,
	`rawPrerequisites` text,
	`spreadsheetRow` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_name_unique` ON `topic` (`name`);--> statement-breakpoint
CREATE INDEX `topic_name_idx` ON `topic` (`name`);--> statement-breakpoint
CREATE TABLE `topic_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topicId` integer NOT NULL,
	`title` text(512) NOT NULL,
	`url` text(2048),
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topic_link_topic_idx` ON `topic_link` (`topicId`);--> statement-breakpoint
CREATE TABLE `topic_tag` (
	`topicId` integer NOT NULL,
	`tagName` text(255) NOT NULL,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagName`) REFERENCES `tag`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_tag_unique` ON `topic_tag` (`topicId`,`tagName`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255),
	`email` text(255) NOT NULL,
	`isNonUser` integer DEFAULT false NOT NULL,
	`emailVerified` integer DEFAULT false,
	`image` text(255),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
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
CREATE TABLE `user_topic_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`topicId` integer NOT NULL,
	`level` text(64) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_topic_status_unique` ON `user_topic_status` (`userId`,`topicId`);--> statement-breakpoint
CREATE INDEX `user_topic_status_user_idx` ON `user_topic_status` (`userId`);--> statement-breakpoint
CREATE INDEX `user_topic_status_topic_idx` ON `user_topic_status` (`topicId`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`identifier` text(255) NOT NULL,
	`value` text(255) NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);