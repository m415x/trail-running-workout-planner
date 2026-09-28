CREATE TABLE `payment_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`payment_id` text NOT NULL,
	`monthly_charge_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`payment_method` text NOT NULL,
	`paid_at` text NOT NULL,
	`voided` integer DEFAULT false NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`monthly_charge_id`) REFERENCES `monthly_charges`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_revisions_amount_positive_check" CHECK("payment_revisions"."amount_minor" > 0),
	CONSTRAINT "payment_revisions_method_check" CHECK("payment_revisions"."payment_method" in ('cash', 'bank_transfer'))
);
--> statement-breakpoint
CREATE INDEX `payment_revisions_monthly_charge_idx` ON `payment_revisions` (`monthly_charge_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_revisions_payment_current_unique` ON `payment_revisions` (`payment_id`) WHERE "payment_revisions"."is_current" = 1;
