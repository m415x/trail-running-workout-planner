CREATE TABLE "planning_cohort_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"planning_cohort_id" text NOT NULL,
	"athlete_profile_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"assigned_by_user_id" text,
	"assignment_reason" text,
	"ended_by_user_id" text,
	"end_reason" text,
	CONSTRAINT "planning_cohort_memberships_date_order_check" CHECK ("planning_cohort_memberships"."end_date" is null or "planning_cohort_memberships"."end_date" >= "planning_cohort_memberships"."start_date"),
	CONSTRAINT "planning_cohort_memberships_open_end_metadata_check" CHECK ("planning_cohort_memberships"."end_date" is not null or ("planning_cohort_memberships"."ended_by_user_id" is null and "planning_cohort_memberships"."end_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "planning_cohorts" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"team_id" text NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "planning_cohorts_status_check" CHECK ("planning_cohorts"."status" in ('active', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "group_training_plans" ADD COLUMN "planning_cohort_id" text;--> statement-breakpoint
ALTER TABLE "group_training_plans" ADD COLUMN "source_group_training_plan_id" text;--> statement-breakpoint
ALTER TABLE "planning_cohort_memberships" ADD CONSTRAINT "planning_cohort_memberships_planning_cohort_id_planning_cohorts_id_fk" FOREIGN KEY ("planning_cohort_id") REFERENCES "public"."planning_cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_cohort_memberships" ADD CONSTRAINT "planning_cohort_memberships_athlete_profile_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_profile_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_cohort_memberships" ADD CONSTRAINT "planning_cohort_memberships_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_cohort_memberships" ADD CONSTRAINT "planning_cohort_memberships_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_cohorts" ADD CONSTRAINT "planning_cohorts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_cohorts" ADD CONSTRAINT "planning_cohorts_group_id_athlete_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."athlete_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planning_cohort_memberships_cohort_dates_idx" ON "planning_cohort_memberships" USING btree ("planning_cohort_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "planning_cohort_memberships_athlete_dates_idx" ON "planning_cohort_memberships" USING btree ("athlete_profile_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "planning_cohorts_team_group_status_idx" ON "planning_cohorts" USING btree ("team_id","group_id","status");--> statement-breakpoint
ALTER TABLE "group_training_plans" ADD CONSTRAINT "group_training_plans_planning_cohort_id_planning_cohorts_id_fk" FOREIGN KEY ("planning_cohort_id") REFERENCES "public"."planning_cohorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_training_plans" ADD CONSTRAINT "group_training_plans_source_group_training_plan_id_group_training_plans_id_fk" FOREIGN KEY ("source_group_training_plan_id") REFERENCES "public"."group_training_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_training_plans_planning_cohort_unique" ON "group_training_plans" USING btree ("planning_cohort_id");--> statement-breakpoint
CREATE INDEX "group_training_plans_source_idx" ON "group_training_plans" USING btree ("source_group_training_plan_id");--> statement-breakpoint
ALTER TABLE "group_training_plans" ADD CONSTRAINT "group_training_plans_cohort_source_pair_check" CHECK (("group_training_plans"."planning_cohort_id" is null and "group_training_plans"."source_group_training_plan_id" is null) or ("group_training_plans"."planning_cohort_id" is not null and "group_training_plans"."source_group_training_plan_id" is not null));--> statement-breakpoint
ALTER TABLE "group_training_plans" ADD CONSTRAINT "group_training_plans_source_not_self_check" CHECK ("group_training_plans"."source_group_training_plan_id" is null or "group_training_plans"."source_group_training_plan_id" <> "group_training_plans"."id");
--> statement-breakpoint
ALTER TABLE "planning_cohorts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "planning_cohort_memberships" ENABLE ROW LEVEL SECURITY;
