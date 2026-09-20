CREATE TABLE `field_performance_test_events` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`team_id` text NOT NULL,
	`group_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`protocol` text NOT NULL,
	`created_by_user_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `athlete_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "field_performance_test_events_protocol_check" CHECK("field_performance_test_events"."protocol" = '1000m_track')
);
--> statement-breakpoint
CREATE INDEX `field_performance_test_events_team_group_date_idx` ON `field_performance_test_events` (`team_id`,`group_id`,`scheduled_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_field_performance_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`athlete_id` text NOT NULL,
	`performed_at` text NOT NULL,
	`protocol` text NOT NULL,
	`source` text NOT NULL,
	`test_event_id` text,
	`execution_context` text,
	`recorded_by` text,
	`review_status` text,
	`distance_m` integer NOT NULL,
	`elapsed_time_sec` real NOT NULL,
	`notes` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_event_id`) REFERENCES `field_performance_test_events`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "field_performance_tests_protocol_check" CHECK("__new_field_performance_tests"."protocol" = '1000m_track'),
	CONSTRAINT "field_performance_tests_source_check" CHECK("__new_field_performance_tests"."source" in ('coach_manual', 'athlete_manual', 'legacy_migration')),
	CONSTRAINT "field_performance_tests_execution_context_check" CHECK("__new_field_performance_tests"."execution_context" is null or "__new_field_performance_tests"."execution_context" in ('official', 'self_directed')),
	CONSTRAINT "field_performance_tests_recorded_by_check" CHECK("__new_field_performance_tests"."recorded_by" is null or "__new_field_performance_tests"."recorded_by" in ('coach', 'athlete')),
	CONSTRAINT "field_performance_tests_review_status_check" CHECK("__new_field_performance_tests"."review_status" is null or "__new_field_performance_tests"."review_status" in ('accepted', 'pending_review', 'rejected')),
	CONSTRAINT "field_performance_tests_official_event_check" CHECK("__new_field_performance_tests"."execution_context" is null or "__new_field_performance_tests"."execution_context" <> 'official' or "__new_field_performance_tests"."test_event_id" is not null),
	CONSTRAINT "field_performance_tests_self_directed_event_check" CHECK("__new_field_performance_tests"."execution_context" is null or "__new_field_performance_tests"."execution_context" <> 'self_directed' or "__new_field_performance_tests"."test_event_id" is null),
	CONSTRAINT "field_performance_tests_distance_check" CHECK("__new_field_performance_tests"."distance_m" = 1000),
	CONSTRAINT "field_performance_tests_elapsed_time_check" CHECK("__new_field_performance_tests"."elapsed_time_sec" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_field_performance_tests`("id", "is_deleted", "created_at", "updated_at", "athlete_id", "performed_at", "protocol", "source", "test_event_id", "execution_context", "recorded_by", "review_status", "distance_m", "elapsed_time_sec", "notes") SELECT "id", "is_deleted", "created_at", "updated_at", "athlete_id", "performed_at", "protocol", "source", "test_event_id", "execution_context", "recorded_by", "review_status", "distance_m", "elapsed_time_sec", "notes" FROM `field_performance_tests`;--> statement-breakpoint
DROP TABLE `field_performance_tests`;--> statement-breakpoint
ALTER TABLE `__new_field_performance_tests` RENAME TO `field_performance_tests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `field_performance_tests_athlete_date_idx` ON `field_performance_tests` (`athlete_id`,`performed_at`);