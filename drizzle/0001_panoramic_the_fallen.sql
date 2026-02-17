CREATE TABLE `bookmark` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`topicId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_user_topic_unique` ON `bookmark` (`userId`,`topicId`);