CREATE TABLE `workout_log_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workout_log_id` text NOT NULL,
	`corrected_by_user_id` text NOT NULL,
	`corrected_at` text NOT NULL,
	`reason` text,
	`before_snapshot` text NOT NULL,
	`after_snapshot` text NOT NULL,
	FOREIGN KEY (`workout_log_id`) REFERENCES `workout_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`corrected_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `workout_log_corrections_log_date_idx` ON `workout_log_corrections` (`workout_log_id`,`corrected_at`);--> statement-breakpoint
CREATE INDEX `workout_log_corrections_actor_date_idx` ON `workout_log_corrections` (`corrected_by_user_id`,`corrected_at`);--> statement-breakpoint
CREATE TABLE `race_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`athlete_profile_id` text NOT NULL,
	`race_event_id` text NOT NULL,
	`race_edition_id` text NOT NULL,
	`race_course_id` text NOT NULL,
	`registration_status` text NOT NULL,
	`participation_status` text NOT NULL,
	`snapshot_event_name` text NOT NULL,
	`snapshot_edition_label` text NOT NULL,
	`snapshot_edition_date` text NOT NULL,
	`snapshot_course_label` text NOT NULL,
	`snapshot_nominal_distance_km` real,
	`snapshot_nominal_elevation_gain_m` real,
	`result_actual_distance_km` real,
	`result_elapsed_time_seconds` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`race_event_id`) REFERENCES `race_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`race_edition_id`) REFERENCES `race_editions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`race_course_id`) REFERENCES `race_courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "race_registrations_registration_status_check" CHECK("race_registrations"."registration_status" in ('registered', 'cancelled')),
	CONSTRAINT "race_registrations_participation_status_check" CHECK("race_registrations"."participation_status" in ('unknown', 'started', 'finished', 'dnf', 'dns')),
	CONSTRAINT "race_registrations_snapshot_nominal_distance_check" CHECK("race_registrations"."snapshot_nominal_distance_km" is null or "race_registrations"."snapshot_nominal_distance_km" >= 0),
	CONSTRAINT "race_registrations_snapshot_nominal_elevation_check" CHECK("race_registrations"."snapshot_nominal_elevation_gain_m" is null or "race_registrations"."snapshot_nominal_elevation_gain_m" >= 0),
	CONSTRAINT "race_registrations_result_actual_distance_check" CHECK("race_registrations"."result_actual_distance_km" is null or "race_registrations"."result_actual_distance_km" >= 0),
	CONSTRAINT "race_registrations_result_elapsed_time_check" CHECK("race_registrations"."result_elapsed_time_seconds" is null or "race_registrations"."result_elapsed_time_seconds" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `race_registrations_team_athlete_edition_unique` ON `race_registrations` (`team_id`,`athlete_profile_id`,`race_edition_id`);--> statement-breakpoint
CREATE INDEX `race_registrations_team_athlete_idx` ON `race_registrations` (`team_id`,`athlete_profile_id`);--> statement-breakpoint
CREATE INDEX `race_registrations_course_idx` ON `race_registrations` (`race_course_id`);