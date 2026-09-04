CREATE TABLE "load_strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_training_plan_id" text NOT NULL,
	"goal_type" text NOT NULL,
	"initial_weekly_volume_km" double precision NOT NULL,
	"maximum_weekly_volume_km" double precision NOT NULL,
	"sessions_per_week" integer NOT NULL,
	"maximum_weekly_increase_percentage" double precision NOT NULL,
	"deload_percentage" double precision NOT NULL,
	"initial_weekly_elevation_gain" integer,
	"maximum_weekly_elevation_gain" integer,
	"field_sources" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "load_strategies" ADD CONSTRAINT "load_strategies_group_training_plan_id_group_training_plans_id_fk" FOREIGN KEY ("group_training_plan_id") REFERENCES "public"."group_training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "load_strategies_group_training_plan_unique" ON "load_strategies" USING btree ("group_training_plan_id");--> statement-breakpoint
ALTER TABLE "load_strategies" ENABLE ROW LEVEL SECURITY;
