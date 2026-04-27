ALTER TABLE `match_request` ADD `meetX` real;--> statement-breakpoint
ALTER TABLE `match_request` ADD `meetY` real;--> statement-breakpoint
ALTER TABLE `match_request` ADD `meetUpdatedAt` integer;--> statement-breakpoint
ALTER TABLE `match_request` ADD `meetUpdatedBy` text(255) REFERENCES user(id);