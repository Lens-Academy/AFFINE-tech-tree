CREATE TABLE `feedback_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transitionId` integer NOT NULL,
	`type` text(32) NOT NULL,
	`topicLinkId` integer,
	`referencedUserId` text(255),
	`freeTextValue` text(1024),
	`helpfulnessRating` text(32),
	`comment` text(2048),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`transitionId`) REFERENCES `level_transition`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topicLinkId`) REFERENCES `topic_link`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`referencedUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `feedback_item_transition_idx` ON `feedback_item` (`transitionId`);--> statement-breakpoint
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
CREATE INDEX `level_transition_user_topic_idx` ON `level_transition` (`userId`,`topicId`);