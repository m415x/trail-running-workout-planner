ALTER TABLE `global_monthly_due_date_exceptions` ADD `created_by_user_id` text REFERENCES users(id) ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE `monthly_charge_reductions` ADD `created_by_user_id` text REFERENCES users(id) ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE `monthly_charge_extensions` ADD `created_by_user_id` text REFERENCES users(id) ON DELETE restrict;