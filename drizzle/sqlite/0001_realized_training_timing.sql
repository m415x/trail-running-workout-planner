PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workout_logs` (
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
	`duration_min` real DEFAULT 0 NOT NULL,
	`elevation_gain` integer DEFAULT 0 NOT NULL,
	`avg_hr` integer,
	`feeling` text,
	`rpe` integer DEFAULT 0,
	`athlete_notes` text,
	`performed_at` text,
	`logged_at` text NOT NULL,
	FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_workout_logs`("id", "is_deleted", "created_at", "updated_at", "athlete_id", "session_id", "workout_id", "date", "status", "distance_km", "duration_min", "elevation_gain", "avg_hr", "feeling", "rpe", "athlete_notes", "performed_at", "logged_at") SELECT "id", "is_deleted", "created_at", "updated_at", "athlete_id", "session_id", "workout_id", "date", "status", "distance_km", "duration_min", "elevation_gain", "avg_hr", "feeling", "rpe", "athlete_notes", NULL, "logged_at" FROM `workout_logs`;--> statement-breakpoint
DROP TABLE `workout_logs`;--> statement-breakpoint
ALTER TABLE `__new_workout_logs` RENAME TO `workout_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;