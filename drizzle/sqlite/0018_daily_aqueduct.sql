CREATE TABLE `team_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`preset` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "team_memberships_date_order_check" CHECK("team_memberships"."effective_until" is null or "team_memberships"."effective_until" > "team_memberships"."effective_from")
);
--> statement-breakpoint
CREATE INDEX `team_memberships_user_team_dates_idx` ON `team_memberships` (`user_id`,`team_id`,`effective_from`,`effective_until`);