CREATE TABLE "readiness_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"team_id" text NOT NULL,
	"athlete_id" text NOT NULL,
	"competition_entry_id" text NOT NULL,
	"evaluated_at" text NOT NULL,
	"analysis_start_date" text NOT NULL,
	"analysis_end_date" text NOT NULL,
	"policy_version" text NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"preparation_snapshot" jsonb NOT NULL,
	"phase_snapshot" jsonb NOT NULL,
	"result_snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readiness_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"readiness_evaluation_id" text NOT NULL,
	"decision" text NOT NULL,
	"reviewed_by_user_id" text NOT NULL,
	"reviewed_at" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "workout_log_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"workout_log_id" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_activity_id" text,
	"known_metric_fields" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "readiness_evaluations" ADD CONSTRAINT "readiness_evaluations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_evaluations" ADD CONSTRAINT "readiness_evaluations_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_evaluations" ADD CONSTRAINT "readiness_evaluations_competition_entry_id_competition_entries_id_fk" FOREIGN KEY ("competition_entry_id") REFERENCES "public"."competition_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_reviews" ADD CONSTRAINT "readiness_reviews_readiness_evaluation_id_readiness_evaluations_id_fk" FOREIGN KEY ("readiness_evaluation_id") REFERENCES "public"."readiness_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_reviews" ADD CONSTRAINT "readiness_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_log_evidence" ADD CONSTRAINT "workout_log_evidence_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "readiness_evaluations_team_athlete_date_idx" ON "readiness_evaluations" USING btree ("team_id","athlete_id","evaluated_at");--> statement-breakpoint
CREATE INDEX "readiness_evaluations_competition_idx" ON "readiness_evaluations" USING btree ("competition_entry_id");--> statement-breakpoint
CREATE INDEX "readiness_reviews_evaluation_date_idx" ON "readiness_reviews" USING btree ("readiness_evaluation_id","reviewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_log_evidence_log_unique" ON "workout_log_evidence" USING btree ("workout_log_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_log_evidence_source_activity_unique" ON "workout_log_evidence" USING btree ("source","source_activity_id");