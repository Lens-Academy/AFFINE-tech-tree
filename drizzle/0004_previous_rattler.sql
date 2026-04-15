CREATE TABLE `match_request` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fromUserId` text(255) NOT NULL,
	`toUserId` text(255) NOT NULL,
	`pairKey` text(511) NOT NULL,
	`status` text(32) DEFAULT 'pending' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`respondedAt` integer,
	FOREIGN KEY (`fromUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`toUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_request_pair_key_unique` ON `match_request` (`pairKey`);--> statement-breakpoint
CREATE INDEX `match_request_from_idx` ON `match_request` (`fromUserId`);--> statement-breakpoint
CREATE INDEX `match_request_to_idx` ON `match_request` (`toUserId`);--> statement-breakpoint
CREATE INDEX `match_request_status_idx` ON `match_request` (`status`);--> statement-breakpoint
ALTER TABLE `user` ADD `segment` text(32);