CREATE TABLE `monthly_charge_reductions` (
  `id` text PRIMARY KEY NOT NULL,
  `is_deleted` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `monthly_charge_id` text NOT NULL,
  `reduction_amount_minor` integer NOT NULL,
  `reason` text NOT NULL,
  `is_current` integer DEFAULT true NOT NULL,
  FOREIGN KEY (`monthly_charge_id`) REFERENCES `monthly_charges`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `monthly_charge_reductions_amount_check` CHECK (`monthly_charge_reductions`."reduction_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_charge_reductions_charge_current_unique`
ON `monthly_charge_reductions` (`monthly_charge_id`)
WHERE `monthly_charge_reductions` ."is_current" = 1;
