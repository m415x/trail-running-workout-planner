CREATE TABLE `external_identity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_identity_links_provider_subject_unique` ON `external_identity_links` (`provider`,`subject`);--> statement-breakpoint
CREATE INDEX `external_identity_links_user_idx` ON `external_identity_links` (`user_id`);