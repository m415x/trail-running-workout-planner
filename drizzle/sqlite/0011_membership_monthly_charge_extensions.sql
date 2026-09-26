CREATE TABLE `monthly_charge_extensions` (
  `id` text PRIMARY KEY NOT NULL,
  `is_deleted` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `monthly_charge_id` text NOT NULL,
  `extended_due_date` text,
  `reason` text NOT NULL,
  `is_current` integer DEFAULT true NOT NULL,
  FOREIGN KEY (`monthly_charge_id`) REFERENCES `monthly_charges`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_charge_extensions_charge_current_unique`
ON `monthly_charge_extensions` (`monthly_charge_id`)
WHERE `monthly_charge_extensions` ."is_current" = 1;
