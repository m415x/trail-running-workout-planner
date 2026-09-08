ALTER TABLE "workouts" ALTER COLUMN "zone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "zone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "distance" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "distance" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "time" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "gain" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "gain" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "archived_at" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "intensity_method" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "pam_percentage" double precision;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "prescription_notes" text;--> statement-breakpoint
UPDATE "workouts"
SET
  "team_id" = COALESCE(
    "team_id",
    (
      SELECT "sessions"."team_id"
      FROM "sessions"
      WHERE "sessions"."workout_id" = "workouts"."id"
      LIMIT 1
    ),
    (SELECT "teams"."id" FROM "teams" ORDER BY "teams"."created_at" LIMIT 1)
  ),
  "category" = COALESCE(
    "category",
    CASE
      WHEN "type" = 'Race' THEN 'competition'
      WHEN "type" IN ('Trail', 'Hills') THEN 'mountain'
      WHEN "type" IN ('Intervals', 'Speed', 'Fartlek', 'PAM') THEN 'quality'
      WHEN "type" = 'Rest' THEN 'recovery'
      ELSE 'endurance'
    END
  ),
  "tags" = COALESCE("tags", '[]'::jsonb),
  "intensity_method" = COALESCE(
    "intensity_method",
    CASE WHEN "zone" IS NULL THEN NULL ELSE 'hr_zone' END
  ),
  "prescription_notes" = COALESCE("prescription_notes", "notes");--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "category" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "tags" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
