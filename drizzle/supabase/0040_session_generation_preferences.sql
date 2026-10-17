CREATE TABLE "session_generation_preferences" (
  "id" text PRIMARY KEY NOT NULL,
  "group_training_plan_id" text NOT NULL,
  "frequency_mode" text NOT NULL,
  "fixed_sessions_per_week" integer,
  "weekly_pattern" text NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_generation_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session_generation_preferences" ADD CONSTRAINT "session_generation_preferences_group_training_plan_id_group_training_plans_id_fk"
  FOREIGN KEY ("group_training_plan_id") REFERENCES "public"."group_training_plans"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "session_generation_preferences_group_training_plan_unique"
  ON "session_generation_preferences" USING btree ("group_training_plan_id");
