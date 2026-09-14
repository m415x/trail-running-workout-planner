CREATE TABLE `athlete_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`category_code` text NOT NULL,
	`level_code` text NOT NULL,
	`team_id` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `athlete_groups_team_category_level_unique` ON `athlete_groups` (`team_id`,`category_code`,`level_code`);--> statement-breakpoint
CREATE TABLE `athlete_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`group_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`nick_name` text,
	`dni` text NOT NULL,
	`birthday` text,
	`phone` text,
	`emergency_contact` text,
	`emergency_phone` text,
	`physiology` text,
	`medical` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `athlete_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `athlete_profiles_user_id_unique` ON `athlete_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `group_history_records` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`athlete_id` text NOT NULL,
	`date` text NOT NULL,
	`previous_group_id` text,
	`new_group_id` text NOT NULL,
	`changed_by_user_id` text,
	`reason` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`previous_group_id`) REFERENCES `athlete_groups`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`new_group_id`) REFERENCES `athlete_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `group_session_prescriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`session_id` text NOT NULL,
	`group_id` text NOT NULL,
	`microcycle_id` text NOT NULL,
	`distance_km` real,
	`duration_min` integer,
	`elevation_gain` integer,
	`intensity_method` text,
	`zone` text,
	`pam_percentage` real,
	`notes` text,
	`generation_ownership` text DEFAULT 'manual' NOT NULL,
	`generation_key` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `athlete_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`microcycle_id`) REFERENCES `microcycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_session_prescriptions_session_group_unique` ON `group_session_prescriptions` (`session_id`,`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_session_prescriptions_generation_key_unique` ON `group_session_prescriptions` (`generation_key`);--> statement-breakpoint
CREATE TABLE `group_training_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`group_id` text NOT NULL,
	`planning_cohort_id` text,
	`source_group_training_plan_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	FOREIGN KEY (`group_id`) REFERENCES `athlete_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`planning_cohort_id`) REFERENCES `planning_cohorts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "group_training_plans_cohort_source_pair_check" CHECK(("group_training_plans"."planning_cohort_id" is null and "group_training_plans"."source_group_training_plan_id" is null) or ("group_training_plans"."planning_cohort_id" is not null and "group_training_plans"."source_group_training_plan_id" is not null)),
	CONSTRAINT "group_training_plans_source_not_self_check" CHECK("group_training_plans"."source_group_training_plan_id" is null or "group_training_plans"."source_group_training_plan_id" <> "group_training_plans"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_training_plans_planning_cohort_unique` ON `group_training_plans` (`planning_cohort_id`);--> statement-breakpoint
CREATE INDEX `group_training_plans_source_idx` ON `group_training_plans` (`source_group_training_plan_id`);--> statement-breakpoint
CREATE TABLE `macrocycles` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`title` text NOT NULL,
	`group_training_plan_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`tapering_weeks_count` integer,
	`target_race_name` text,
	`target_race_date` text,
	`target_race_distance_km` real,
	`target_race_elevation_gain` integer,
	`notes` text,
	FOREIGN KEY (`group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`athlete_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text,
	`notes` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mesocycles` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`macrocycle_id` text NOT NULL,
	`title` text NOT NULL,
	`number` integer NOT NULL,
	`period` text NOT NULL,
	`objective` text NOT NULL,
	FOREIGN KEY (`macrocycle_id`) REFERENCES `macrocycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `microcycles` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`mesocycle_id` text NOT NULL,
	`week_number` integer NOT NULL,
	`type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`target_volume_km` real,
	`target_volume_source` text DEFAULT 'generated' NOT NULL,
	`target_elevation_gain` integer,
	`target_elevation_source` text DEFAULT 'generated' NOT NULL,
	`target_duration_min` integer,
	`notes` text,
	FOREIGN KEY (`mesocycle_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `physiology_records` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`athlete_id` text NOT NULL,
	`date` text NOT NULL,
	`pam_time_sec` integer NOT NULL,
	`pam_pace_formatted` text NOT NULL,
	`pam_speed_kmh` real,
	`max_hr` integer NOT NULL,
	`rest_hr` integer NOT NULL,
	`threshold_hr` integer,
	`weight_kg` real,
	`height_cm` real,
	`test_type` text,
	`notes` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `planning_cohort_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`planning_cohort_id` text NOT NULL,
	`athlete_profile_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`assigned_by_user_id` text,
	`assignment_reason` text,
	`ended_by_user_id` text,
	`end_reason` text,
	FOREIGN KEY (`planning_cohort_id`) REFERENCES `planning_cohorts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`athlete_profile_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ended_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "planning_cohort_memberships_date_order_check" CHECK("planning_cohort_memberships"."end_date" is null or "planning_cohort_memberships"."end_date" >= "planning_cohort_memberships"."start_date"),
	CONSTRAINT "planning_cohort_memberships_open_end_metadata_check" CHECK("planning_cohort_memberships"."end_date" is not null or ("planning_cohort_memberships"."ended_by_user_id" is null and "planning_cohort_memberships"."end_reason" is null))
);
--> statement-breakpoint
CREATE INDEX `planning_cohort_memberships_cohort_dates_idx` ON `planning_cohort_memberships` (`planning_cohort_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `planning_cohort_memberships_athlete_dates_idx` ON `planning_cohort_memberships` (`athlete_profile_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `planning_cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`team_id` text NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `athlete_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "planning_cohorts_status_check" CHECK("planning_cohorts"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `planning_cohorts_team_group_status_idx` ON `planning_cohorts` (`team_id`,`group_id`,`status`);--> statement-breakpoint
CREATE TABLE `planning_modification_records` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`group_training_plan_id` text NOT NULL,
	`microcycle_id` text,
	`field` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`changed_by_user_id` text,
	FOREIGN KEY (`group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`microcycle_id`) REFERENCES `microcycles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `session_generation_modification_records` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`group_training_plan_id` text NOT NULL,
	`session_id` text,
	`prescription_id` text,
	`action` text NOT NULL,
	`ownership` text NOT NULL,
	`generation_key` text,
	`previous_value` text,
	`new_value` text,
	`changed_by_user_id` text,
	FOREIGN KEY (`group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`prescription_id`) REFERENCES `group_session_prescriptions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`team_id` text NOT NULL,
	`workout_id` text,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`location_key` text,
	`track_path` text,
	`structure` text,
	`notes` text,
	`generation_ownership` text DEFAULT 'manual' NOT NULL,
	`shared_event_key` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`location_key`) REFERENCES `training_locations`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_shared_event_key_unique` ON `sessions` (`shared_event_key`);--> statement-breakpoint
CREATE TABLE `shoes` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`athlete_id` text NOT NULL,
	`type` text NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`max_km` real NOT NULL,
	`purchase_date` text,
	`current_km` real DEFAULT 0 NOT NULL,
	`retired_at` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`avatar_light` text,
	`avatar_dark` text
);
--> statement-breakpoint
CREATE TABLE `training_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`athlete_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`target_date` text,
	`race_name` text,
	`race_distance_km` real,
	`race_elevation_gain` integer,
	`notes` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `training_locations` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lon` real NOT NULL,
	`lat` real NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`role` text DEFAULT 'athlete' NOT NULL,
	`user_name` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`avatar` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_user_name_unique` ON `users` (`user_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workout_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`athlete_id` text NOT NULL,
	`session_id` text,
	`workout_id` text,
	`date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`distance_km` real DEFAULT 0 NOT NULL,
	`duration_min` integer DEFAULT 0 NOT NULL,
	`elevation_gain` integer DEFAULT 0 NOT NULL,
	`avg_hr` integer,
	`feeling` text,
	`rpe` integer DEFAULT 0,
	`athlete_notes` text,
	`logged_at` text NOT NULL,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`team_id` text NOT NULL,
	`category` text NOT NULL,
	`tags` text NOT NULL,
	`archived_at` text,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`distance` real,
	`time` integer,
	`gain` integer,
	`intensity_method` text,
	`zone` text,
	`pam_percentage` real,
	`pace` integer,
	`notes` text,
	`prescription_notes` text,
	`track_path` text,
	`location_key` text,
	`structure` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_key`) REFERENCES `training_locations`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `load_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`group_training_plan_id` text NOT NULL,
	`goal_type` text NOT NULL,
	`initial_weekly_volume_km` real NOT NULL,
	`maximum_weekly_volume_km` real NOT NULL,
	`maximum_weekly_increase_percentage` real NOT NULL,
	`deload_percentage` real NOT NULL,
	`initial_weekly_elevation_gain` integer,
	`maximum_weekly_elevation_gain` integer,
	`field_sources` text NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `load_strategies_group_training_plan_unique` ON `load_strategies` (`group_training_plan_id`);--> statement-breakpoint
CREATE TABLE `intensity_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`group_training_plan_id` text NOT NULL,
	`goal_type` text NOT NULL,
	`default_method` text NOT NULL,
	`maximum_intense_sessions_per_week` integer NOT NULL,
	`minimum_recovery_days_between_intense_sessions` integer NOT NULL,
	`field_sources` text NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intensity_strategies_plan_unique` ON `intensity_strategies` (`group_training_plan_id`);--> statement-breakpoint
CREATE TABLE `microcycle_intensity_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`microcycle_id` text NOT NULL,
	`emphasis` text NOT NULL,
	`intense_sessions_target` integer NOT NULL,
	`predominant_zone` text NOT NULL,
	`pam_percentage_target` real,
	`minimum_recovery_days_between_intense_sessions` integer NOT NULL,
	`field_sources` text NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`microcycle_id`) REFERENCES `microcycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `microcycle_intensity_targets_microcycle_unique` ON `microcycle_intensity_targets` (`microcycle_id`);--> statement-breakpoint
CREATE TABLE `session_generation_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`group_training_plan_id` text NOT NULL,
	`frequency_mode` text NOT NULL,
	`fixed_sessions_per_week` integer,
	`weekly_pattern` text NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_generation_preferences_group_training_plan_unique` ON `session_generation_preferences` (`group_training_plan_id`);--> statement-breakpoint
CREATE TABLE `competition_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`group_training_plan_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`distance_km` real NOT NULL,
	`elevation_gain_m` real,
	`priority` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`description` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_training_plan_id`) REFERENCES `group_training_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "competition_entries_name_check" CHECK(length(trim("competition_entries"."name")) > 0),
	CONSTRAINT "competition_entries_distance_check" CHECK("competition_entries"."distance_km" > 0),
	CONSTRAINT "competition_entries_elevation_gain_check" CHECK("competition_entries"."elevation_gain_m" is null or "competition_entries"."elevation_gain_m" >= 0),
	CONSTRAINT "competition_entries_priority_check" CHECK("competition_entries"."priority" in ('A', 'B', 'C')),
	CONSTRAINT "competition_entries_status_check" CHECK("competition_entries"."status" in ('planned', 'confirmed', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `competition_entries_plan_date_idx` ON `competition_entries` (`group_training_plan_id`,`date`);--> statement-breakpoint
CREATE INDEX `competition_entries_plan_status_date_idx` ON `competition_entries` (`group_training_plan_id`,`status`,`date`);--> statement-breakpoint
CREATE TABLE `readiness_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`team_id` text NOT NULL,
	`athlete_id` text NOT NULL,
	`competition_entry_id` text NOT NULL,
	`evaluated_at` text NOT NULL,
	`analysis_start_date` text NOT NULL,
	`analysis_end_date` text NOT NULL,
	`policy_version` text NOT NULL,
	`policy_snapshot` text NOT NULL,
	`preparation_snapshot` text NOT NULL,
	`phase_snapshot` text NOT NULL,
	`result_snapshot` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competition_entry_id`) REFERENCES `competition_entries`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `readiness_evaluations_team_athlete_date_idx` ON `readiness_evaluations` (`team_id`,`athlete_id`,`evaluated_at`);--> statement-breakpoint
CREATE INDEX `readiness_evaluations_competition_idx` ON `readiness_evaluations` (`competition_entry_id`);--> statement-breakpoint
CREATE TABLE `readiness_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`readiness_evaluation_id` text NOT NULL,
	`decision` text NOT NULL,
	`reviewed_by_user_id` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`readiness_evaluation_id`) REFERENCES `readiness_evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `readiness_reviews_evaluation_date_idx` ON `readiness_reviews` (`readiness_evaluation_id`,`reviewed_at`);--> statement-breakpoint
CREATE TABLE `workout_log_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workout_log_id` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_activity_id` text,
	`known_metric_fields` text NOT NULL,
	FOREIGN KEY (`workout_log_id`) REFERENCES `workout_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_log_evidence_log_unique` ON `workout_log_evidence` (`workout_log_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workout_log_evidence_source_activity_unique` ON `workout_log_evidence` (`source`,`source_activity_id`);--> statement-breakpoint
CREATE TABLE `competition_entry_race_courses` (
	`competition_entry_id` text PRIMARY KEY NOT NULL,
	`race_course_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`competition_entry_id`) REFERENCES `competition_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`race_course_id`) REFERENCES `race_courses`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `competition_entry_race_courses_course_idx` ON `competition_entry_race_courses` (`race_course_id`);--> statement-breakpoint
CREATE TABLE `race_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`race_edition_id` text NOT NULL,
	`label` text NOT NULL,
	`distance_km` real,
	`elevation_gain_m` real,
	`modality` text,
	`classifications` text NOT NULL,
	`scheduled_start_at` text,
	`start_location_label` text,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_origin` text DEFAULT 'product' NOT NULL,
	`source_provider` text,
	`external_id` text,
	`source_url` text,
	FOREIGN KEY (`race_edition_id`) REFERENCES `race_editions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "race_courses_label_check" CHECK(length(trim("race_courses"."label")) > 0),
	CONSTRAINT "race_courses_distance_check" CHECK("race_courses"."distance_km" is null or "race_courses"."distance_km" > 0),
	CONSTRAINT "race_courses_elevation_check" CHECK("race_courses"."elevation_gain_m" is null or "race_courses"."elevation_gain_m" >= 0),
	CONSTRAINT "race_courses_status_check" CHECK("race_courses"."status" in ('draft', 'published', 'cancelled')),
	CONSTRAINT "race_courses_source_origin_check" CHECK("race_courses"."source_origin" in ('product', 'external')),
	CONSTRAINT "race_courses_external_source_check" CHECK("race_courses"."source_origin" = 'product' or ("race_courses"."source_provider" is not null and "race_courses"."external_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `race_courses_edition_status_idx` ON `race_courses` (`race_edition_id`,`status`);--> statement-breakpoint
CREATE INDEX `race_courses_distance_idx` ON `race_courses` (`distance_km`);--> statement-breakpoint
CREATE UNIQUE INDEX `race_courses_source_external_unique` ON `race_courses` (`source_provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `race_editions` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`race_event_id` text NOT NULL,
	`label` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`organizer_name` text,
	`location` text,
	`website_url` text,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_origin` text DEFAULT 'product' NOT NULL,
	`source_provider` text,
	`external_id` text,
	`source_url` text,
	FOREIGN KEY (`race_event_id`) REFERENCES `race_events`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "race_editions_label_check" CHECK(length(trim("race_editions"."label")) > 0),
	CONSTRAINT "race_editions_date_order_check" CHECK("race_editions"."end_date" is null or "race_editions"."end_date" >= "race_editions"."start_date"),
	CONSTRAINT "race_editions_status_check" CHECK("race_editions"."status" in ('draft', 'published', 'completed', 'cancelled')),
	CONSTRAINT "race_editions_source_origin_check" CHECK("race_editions"."source_origin" in ('product', 'external')),
	CONSTRAINT "race_editions_external_source_check" CHECK("race_editions"."source_origin" = 'product' or ("race_editions"."source_provider" is not null and "race_editions"."external_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `race_editions_event_start_idx` ON `race_editions` (`race_event_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `race_editions_status_start_idx` ON `race_editions` (`status`,`start_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `race_editions_source_external_unique` ON `race_editions` (`source_provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `race_events` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`website_url` text,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`source_origin` text DEFAULT 'product' NOT NULL,
	`source_provider` text,
	`external_id` text,
	`source_url` text,
	CONSTRAINT "race_events_name_check" CHECK(length(trim("race_events"."name")) > 0),
	CONSTRAINT "race_events_status_check" CHECK("race_events"."status" in ('active', 'archived')),
	CONSTRAINT "race_events_source_origin_check" CHECK("race_events"."source_origin" in ('product', 'external')),
	CONSTRAINT "race_events_external_source_check" CHECK("race_events"."source_origin" = 'product' or ("race_events"."source_provider" is not null and "race_events"."external_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `race_events_status_name_idx` ON `race_events` (`status`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `race_events_source_external_unique` ON `race_events` (`source_provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `training_goal_race_courses` (
	`training_goal_id` text PRIMARY KEY NOT NULL,
	`race_course_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`training_goal_id`) REFERENCES `training_goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`race_course_id`) REFERENCES `race_courses`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `training_goal_race_courses_course_idx` ON `training_goal_race_courses` (`race_course_id`);