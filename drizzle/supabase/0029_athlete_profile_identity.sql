-- KAN-615/T2: versioned PostgreSQL schema transition.
-- Static artifact only. No server execution authorized.
ALTER TABLE "athlete_profiles"
  ADD COLUMN "first_name" text;
--> statement-breakpoint
ALTER TABLE "athlete_profiles"
  ADD COLUMN "last_name" text;
--> statement-breakpoint
ALTER TABLE "athlete_profiles"
  ADD COLUMN "contact_email" text;
--> statement-breakpoint

-- Copy only facts from the user's persisted foreign-key association.
-- Existing profile values take precedence.
UPDATE "athlete_profiles" AS a
SET
  "first_name" = COALESCE(a."first_name", u."first_name"),
  "last_name" = COALESCE(a."last_name", u."last_name"),
  "contact_email" = COALESCE(a."contact_email", u."email")
FROM "users" AS u
WHERE a."user_id" = u."id"
  AND (
    a."first_name" IS NULL
    OR a."last_name" IS NULL
    OR a."contact_email" IS NULL
  );
--> statement-breakpoint

ALTER TABLE "athlete_profiles"
  ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "athlete_profiles"
  DROP CONSTRAINT "athlete_profiles_user_id_users_id_fk";
--> statement-breakpoint

ALTER TABLE "athlete_profiles"
  ADD CONSTRAINT "athlete_profiles_user_id_users_id_fk"
  FOREIGN KEY ("user_id")
  REFERENCES "public"."users"("id")
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "athlete_profiles"
  DROP CONSTRAINT "athlete_profiles_user_id_unique";
--> statement-breakpoint

CREATE UNIQUE INDEX "athlete_profiles_user_team_unique"
  ON "athlete_profiles" USING btree ("user_id", "team_id");
