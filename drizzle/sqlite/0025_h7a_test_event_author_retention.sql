PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_field_performance_test_events` (
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
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE RESTRICT,
  CONSTRAINT `field_performance_test_events_protocol_check` CHECK (`protocol` = '1000m_track')
);--> statement-breakpoint
INSERT INTO `__new_field_performance_test_events` (`id`,`is_deleted`,`created_at`,`updated_at`,`team_id`,`group_id`,`scheduled_at`,`protocol`,`created_by_user_id`) SELECT `id`,`is_deleted`,`created_at`,`updated_at`,`team_id`,`group_id`,`scheduled_at`,`protocol`,`created_by_user_id` FROM `field_performance_test_events`;--> statement-breakpoint
DROP TABLE `field_performance_test_events`;--> statement-breakpoint
ALTER TABLE `__new_field_performance_test_events` RENAME TO `field_performance_test_events`;--> statement-breakpoint
CREATE INDEX `field_performance_test_events_team_group_date_idx` ON `field_performance_test_events` (`team_id`,`group_id`,`scheduled_at`);--> statement-breakpoint
PRAGMA foreign_keys=ON;