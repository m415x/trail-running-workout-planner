ALTER TABLE "microcycle_intensity_targets" RENAME COLUMN "pam_percentage_target" TO "reference_percentage_target";--> statement-breakpoint
ALTER TABLE "group_session_prescriptions" RENAME COLUMN "pam_percentage" TO "reference_percentage";--> statement-breakpoint
ALTER TABLE "workouts" RENAME COLUMN "pam_percentage" TO "reference_percentage";--> statement-breakpoint
UPDATE "intensity_strategies" SET "default_method" = 'reference_percentage' WHERE "default_method" = 'pam_percentage';--> statement-breakpoint
UPDATE "group_session_prescriptions" SET "intensity_method" = 'reference_percentage' WHERE "intensity_method" = 'pam_percentage';--> statement-breakpoint
UPDATE "workouts" SET "intensity_method" = 'reference_percentage' WHERE "intensity_method" = 'pam_percentage';--> statement-breakpoint
UPDATE "microcycle_intensity_targets" SET "field_sources" = replace("field_sources"::text, '"pamPercentageTarget"', '"referencePercentageTarget"')::jsonb WHERE "field_sources"::text LIKE '%"pamPercentageTarget"%';