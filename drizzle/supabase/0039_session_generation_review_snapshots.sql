CREATE TABLE "session_generation_review_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"group_training_plan_id" text NOT NULL,
	"group_id" text NOT NULL,
	"planning_cohort_id" text,
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
	CONSTRAINT "session_generation_review_snapshots_status_check" CHECK ("session_generation_review_snapshots"."status" in ('active', 'consumed', 'expired', 'invalidated'))
);
--> statement-breakpoint
ALTER TABLE "session_generation_review_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_generation_review_snapshots" ADD CONSTRAINT "session_generation_review_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_generation_review_snapshots" ADD CONSTRAINT "session_generation_review_snapshots_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_generation_review_snapshots" ADD CONSTRAINT "session_generation_review_snapshots_group_training_plan_id_group_training_plans_id_fk" FOREIGN KEY ("group_training_plan_id") REFERENCES "public"."group_training_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_generation_review_snapshots" ADD CONSTRAINT "session_generation_review_snapshots_group_id_athlete_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."athlete_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_generation_review_snapshots" ADD CONSTRAINT "session_generation_review_snapshots_planning_cohort_id_planning_cohorts_id_fk" FOREIGN KEY ("planning_cohort_id") REFERENCES "public"."planning_cohorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_generation_review_snapshots_owner_idx" ON "session_generation_review_snapshots" USING btree ("user_id","team_id","group_training_plan_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "session_generation_review_snapshots_expiry_idx" ON "session_generation_review_snapshots" USING btree ("expires_at");