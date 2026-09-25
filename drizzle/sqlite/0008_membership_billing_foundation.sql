CREATE TABLE `team_economic_policies` (
  `id` text PRIMARY KEY NOT NULL,
  `is_deleted` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `team_id` text NOT NULL,
  `default_monthly_amount_minor` integer NOT NULL,
  `currency` text NOT NULL,
  `ordinary_due_day` integer NOT NULL,
  `effective_from` text NOT NULL,
  `effective_until` text,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `team_economic_policies_amount_positive_check` CHECK (`team_economic_policies`."default_monthly_amount_minor" > 0),
  CONSTRAINT `team_economic_policies_due_day_check` CHECK (`team_economic_policies`."ordinary_due_day" between 1 and 31),
  CONSTRAINT `team_economic_policies_date_order_check` CHECK (`team_economic_policies`."effective_until" is null or `team_economic_policies`."effective_until" > `team_economic_policies`."effective_from")
);
--> statement-breakpoint
CREATE INDEX `team_economic_policies_team_dates_idx` ON `team_economic_policies` (`team_id`,`effective_from`,`effective_until`);
--> statement-breakpoint
CREATE TABLE `athlete_billing_terms` (
  `id` text PRIMARY KEY NOT NULL,
  `is_deleted` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `athlete_id` text NOT NULL,
  `monthly_amount_minor` integer NOT NULL,
  `currency` text NOT NULL,
  `effective_from` text NOT NULL,
  `effective_until` text,
  FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `athlete_billing_terms_amount_positive_check` CHECK (`athlete_billing_terms`."monthly_amount_minor" > 0),
  CONSTRAINT `athlete_billing_terms_date_order_check` CHECK (`athlete_billing_terms`."effective_until" is null or `athlete_billing_terms`."effective_until" > `athlete_billing_terms`."effective_from")
);
--> statement-breakpoint
CREATE INDEX `athlete_billing_terms_athlete_dates_idx` ON `athlete_billing_terms` (`athlete_id`,`effective_from`,`effective_until`);
--> statement-breakpoint
CREATE TABLE `monthly_charges` (
  `id` text PRIMARY KEY NOT NULL,
  `is_deleted` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `athlete_id` text NOT NULL,
  `billing_terms_id` text NOT NULL,
  `year` integer NOT NULL,
  `month` integer NOT NULL,
  `base_amount_minor` integer NOT NULL,
  `amount_due_minor` integer NOT NULL,
  `currency` text NOT NULL,
  `base_due_date` text NOT NULL,
  `effective_due_date` text NOT NULL,
  FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`billing_terms_id`) REFERENCES `athlete_billing_terms`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `monthly_charges_month_check` CHECK (`monthly_charges`."month" between 1 and 12),
  CONSTRAINT `monthly_charges_amount_positive_check` CHECK (`monthly_charges`."base_amount_minor" > 0 and `monthly_charges`."amount_due_minor" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_charges_athlete_year_month_unique` ON `monthly_charges` (`athlete_id`,`year`,`month`);
--> statement-breakpoint
CREATE INDEX `monthly_charges_billing_terms_idx` ON `monthly_charges` (`billing_terms_id`);
