ALTER TABLE "workout_logs" ALTER COLUMN "duration_min" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD COLUMN "performed_at" text;