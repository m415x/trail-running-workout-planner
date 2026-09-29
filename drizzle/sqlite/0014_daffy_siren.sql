CREATE TABLE `athlete_session_adjustment_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`adjustment_id` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`payload` text NOT NULL,
	`reason` text NOT NULL,
	`changed_by_user_id` text,
	`is_current` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`adjustment_id`) REFERENCES `athlete_session_adjustments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "athlete_session_adjustment_revisions_state_check" CHECK("athlete_session_adjustment_revisions"."state" in ('active', 'withdrawn'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `athlete_session_adjustment_revisions_current_unique` ON `athlete_session_adjustment_revisions` (`adjustment_id`) WHERE "athlete_session_adjustment_revisions"."is_current" = 1;--> statement-breakpoint
CREATE TABLE `athlete_session_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`team_id` text NOT NULL,
	`athlete_id` text NOT NULL,
	`source_prescription_id` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_prescription_id`) REFERENCES `group_session_prescriptions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `athlete_session_adjustments_athlete_prescription_unique` ON `athlete_session_adjustments` (`athlete_id`,`source_prescription_id`);
