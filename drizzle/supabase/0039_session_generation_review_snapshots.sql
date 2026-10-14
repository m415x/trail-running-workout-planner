CREATE TABLE "session_generation_review_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "team_id" text NOT NULL REFERENCES "teams"("id") ON DELETE RESTRICT,
  "group_training_plan_id" text NOT NULL REFERENCES "group_training_plans"("id") ON DELETE RESTRICT,
  "group_id" text NOT NULL REFERENCES "athlete_groups"("id") ON DELETE RESTRICT,
  "planning_cohort_id" text REFERENCES "planning_cohorts"("id") ON DELETE RESTRICT,
  "schema_version" text NOT NULL,
  "generator_version" text NOT NULL,
  "proposal" jsonb NOT NULL,
  "generation_explanations" jsonb NOT NULL,
  "source_manifest" jsonb NOT NULL,
  "created_at" text NOT NULL,
  "expires_at" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "consumed_at" text,
  "result_reference" text,
  CONSTRAINT "session_generation_review_snapshots_status_check"
    CHECK ("status" IN ('active','consumed','expired','invalidated'))
);
CREATE INDEX "session_generation_review_snapshots_owner_idx" ON "session_generation_review_snapshots" ("user_id","team_id","group_training_plan_id","status","expires_at");
CREATE INDEX "session_generation_review_snapshots_expiry_idx" ON "session_generation_review_snapshots" ("expires_at");
ALTER TABLE "session_generation_review_snapshots" ENABLE ROW LEVEL SECURITY;
