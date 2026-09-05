CREATE TABLE "intensity_strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_training_plan_id" text NOT NULL,
	"goal_type" text NOT NULL,
	"default_method" text NOT NULL,
	"maximum_intense_sessions_per_week" integer NOT NULL,
	"minimum_recovery_days_between_intense_sessions" integer NOT NULL,
	"field_sources" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "microcycle_intensity_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"microcycle_id" text NOT NULL,
	"emphasis" text NOT NULL,
	"intense_sessions_target" integer NOT NULL,
	"predominant_zone" text NOT NULL,
	"pam_percentage_target" double precision,
	"minimum_recovery_days_between_intense_sessions" integer NOT NULL,
	"field_sources" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intensity_strategies" ADD CONSTRAINT "intensity_strategies_group_training_plan_id_group_training_plans_id_fk" FOREIGN KEY ("group_training_plan_id") REFERENCES "public"."group_training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microcycle_intensity_targets" ADD CONSTRAINT "microcycle_intensity_targets_microcycle_id_microcycles_id_fk" FOREIGN KEY ("microcycle_id") REFERENCES "public"."microcycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "intensity_strategies_plan_unique" ON "intensity_strategies" USING btree ("group_training_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "microcycle_intensity_targets_microcycle_unique" ON "microcycle_intensity_targets" USING btree ("microcycle_id");--> statement-breakpoint
ALTER TABLE "intensity_strategies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "microcycle_intensity_targets" ENABLE ROW LEVEL SECURITY;
