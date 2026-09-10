CREATE TABLE "competition_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"group_training_plan_id" text NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"distance_km" double precision NOT NULL,
	"elevation_gain_m" double precision,
	"priority" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"description" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "competition_entries_name_check" CHECK (length(btrim("competition_entries"."name")) > 0),
	CONSTRAINT "competition_entries_distance_check" CHECK ("competition_entries"."distance_km" > 0),
	CONSTRAINT "competition_entries_elevation_gain_check" CHECK ("competition_entries"."elevation_gain_m" is null or "competition_entries"."elevation_gain_m" >= 0),
	CONSTRAINT "competition_entries_priority_check" CHECK ("competition_entries"."priority" in ('A', 'B', 'C')),
	CONSTRAINT "competition_entries_status_check" CHECK ("competition_entries"."status" in ('planned', 'confirmed', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_group_training_plan_id_group_training_plans_id_fk" FOREIGN KEY ("group_training_plan_id") REFERENCES "public"."group_training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competition_entries_plan_date_idx" ON "competition_entries" USING btree ("group_training_plan_id","date");--> statement-breakpoint
CREATE INDEX "competition_entries_plan_status_date_idx" ON "competition_entries" USING btree ("group_training_plan_id","status","date");