CREATE TABLE `global_monthly_due_date_exceptions` (
  `id` text PRIMARY KEY NOT NULL,
  `is_deleted` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `team_id` text NOT NULL,
  `year` integer NOT NULL,
  `month` integer NOT NULL,
  `due_date` text NOT NULL,
  `reason` text NOT NULL,
  `is_current` integer DEFAULT true NOT NULL,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `global_monthly_due_date_exceptions_month_check` CHECK (`global_monthly_due_date_exceptions`."month" between 1 and 12)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `global_monthly_due_date_exceptions_team_period_current_unique`
ON `global_monthly_due_date_exceptions` (`team_id`,`year`,`month`)
WHERE `global_monthly_due_date_exceptions` ."is_current" = 1;
