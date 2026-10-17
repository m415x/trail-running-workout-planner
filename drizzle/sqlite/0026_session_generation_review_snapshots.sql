CREATE TABLE `session_generation_review_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`group_training_plan_id` text NOT NULL,
	`group_id` text NOT NULL,
	`planning_cohort_id` text,
	`schema_version` text NOT NULL,
	`generator_version` text NOT NULL,
	`proposal` text NOT NULL,
	`generation_explanations` text NOT NULL,
	`source_manifest` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`consumed_at` text,
	`result_reference` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`group_id`) REFERENCES `athlete_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`planning_cohort_id`) REFERENCES `planning_cohorts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "session_generation_review_snapshots_status_check" CHECK("session_generation_review_snapshots"."status" in ('active', 'consumed', 'expired', 'invalidated'))
);
--> statement-breakpoint
CREATE INDEX `session_generation_review_snapshots_owner_idx` ON `session_generation_review_snapshots` (`user_id`,`team_id`,`group_training_plan_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `session_generation_review_snapshots_expiry_idx` ON `session_generation_review_snapshots` (`expires_at`);