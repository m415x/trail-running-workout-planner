CREATE TABLE "athlete_session_adjustment_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"adjustment_id" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"payload" jsonb NOT NULL,
	"reason" text NOT NULL,
	"changed_by_user_id" text,
	"is_current" boolean DEFAULT true NOT NULL,
	CONSTRAINT "athlete_session_adjustment_revisions_state_check" CHECK ("athlete_session_adjustment_revisions"."state" in ('active', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "athlete_session_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"team_id" text NOT NULL,
	"athlete_id" text NOT NULL,
	"source_prescription_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athlete_session_adjustment_revisions" ADD CONSTRAINT "athlete_session_adjustment_revisions_adjustment_id_athlete_session_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."athlete_session_adjustments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_adjustment_revisions" ADD CONSTRAINT "athlete_session_adjustment_revisions_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_adjustments" ADD CONSTRAINT "athlete_session_adjustments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_adjustments" ADD CONSTRAINT "athlete_session_adjustments_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_adjustments" ADD CONSTRAINT "athlete_session_adjustments_source_prescription_id_group_session_prescriptions_id_fk" FOREIGN KEY ("source_prescription_id") REFERENCES "public"."group_session_prescriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_session_adjustment_revisions_current_unique" ON "athlete_session_adjustment_revisions" USING btree ("adjustment_id") WHERE "athlete_session_adjustment_revisions"."is_current" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_session_adjustments_athlete_prescription_unique" ON "athlete_session_adjustments" USING btree ("athlete_id","source_prescription_id");