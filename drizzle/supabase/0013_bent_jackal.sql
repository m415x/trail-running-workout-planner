CREATE TABLE "competition_entry_race_courses" (
	"competition_entry_id" text PRIMARY KEY NOT NULL,
	"race_course_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_courses" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"race_edition_id" text NOT NULL,
	"label" text NOT NULL,
	"distance_km" double precision,
	"elevation_gain_m" double precision,
	"modality" jsonb,
	"classifications" jsonb NOT NULL,
	"scheduled_start_at" text,
	"start_location_label" text,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_origin" text DEFAULT 'product' NOT NULL,
	"source_provider" text,
	"external_id" text,
	"source_url" text,
	CONSTRAINT "race_courses_label_check" CHECK (length(trim("race_courses"."label")) > 0),
	CONSTRAINT "race_courses_distance_check" CHECK ("race_courses"."distance_km" is null or "race_courses"."distance_km" > 0),
	CONSTRAINT "race_courses_elevation_check" CHECK ("race_courses"."elevation_gain_m" is null or "race_courses"."elevation_gain_m" >= 0),
	CONSTRAINT "race_courses_status_check" CHECK ("race_courses"."status" in ('draft', 'published', 'cancelled')),
	CONSTRAINT "race_courses_source_origin_check" CHECK ("race_courses"."source_origin" in ('product', 'external')),
	CONSTRAINT "race_courses_external_source_check" CHECK ("race_courses"."source_origin" = 'product' or ("race_courses"."source_provider" is not null and "race_courses"."external_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "race_editions" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"race_event_id" text NOT NULL,
	"label" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"organizer_name" text,
	"location" jsonb,
	"website_url" text,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_origin" text DEFAULT 'product' NOT NULL,
	"source_provider" text,
	"external_id" text,
	"source_url" text,
	CONSTRAINT "race_editions_label_check" CHECK (length(trim("race_editions"."label")) > 0),
	CONSTRAINT "race_editions_date_order_check" CHECK ("race_editions"."end_date" is null or "race_editions"."end_date" >= "race_editions"."start_date"),
	CONSTRAINT "race_editions_status_check" CHECK ("race_editions"."status" in ('draft', 'published', 'completed', 'cancelled')),
	CONSTRAINT "race_editions_source_origin_check" CHECK ("race_editions"."source_origin" in ('product', 'external')),
	CONSTRAINT "race_editions_external_source_check" CHECK ("race_editions"."source_origin" = 'product' or ("race_editions"."source_provider" is not null and "race_editions"."external_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "race_events" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"source_origin" text DEFAULT 'product' NOT NULL,
	"source_provider" text,
	"external_id" text,
	"source_url" text,
	CONSTRAINT "race_events_name_check" CHECK (length(trim("race_events"."name")) > 0),
	CONSTRAINT "race_events_status_check" CHECK ("race_events"."status" in ('active', 'archived')),
	CONSTRAINT "race_events_source_origin_check" CHECK ("race_events"."source_origin" in ('product', 'external')),
	CONSTRAINT "race_events_external_source_check" CHECK ("race_events"."source_origin" = 'product' or ("race_events"."source_provider" is not null and "race_events"."external_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "training_goal_race_courses" (
	"training_goal_id" text PRIMARY KEY NOT NULL,
	"race_course_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competition_entry_race_courses" ADD CONSTRAINT "competition_entry_race_courses_competition_entry_id_competition_entries_id_fk" FOREIGN KEY ("competition_entry_id") REFERENCES "public"."competition_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entry_race_courses" ADD CONSTRAINT "competition_entry_race_courses_race_course_id_race_courses_id_fk" FOREIGN KEY ("race_course_id") REFERENCES "public"."race_courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_courses" ADD CONSTRAINT "race_courses_race_edition_id_race_editions_id_fk" FOREIGN KEY ("race_edition_id") REFERENCES "public"."race_editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_editions" ADD CONSTRAINT "race_editions_race_event_id_race_events_id_fk" FOREIGN KEY ("race_event_id") REFERENCES "public"."race_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_goal_race_courses" ADD CONSTRAINT "training_goal_race_courses_training_goal_id_training_goals_id_fk" FOREIGN KEY ("training_goal_id") REFERENCES "public"."training_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_goal_race_courses" ADD CONSTRAINT "training_goal_race_courses_race_course_id_race_courses_id_fk" FOREIGN KEY ("race_course_id") REFERENCES "public"."race_courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competition_entry_race_courses_course_idx" ON "competition_entry_race_courses" USING btree ("race_course_id");--> statement-breakpoint
CREATE INDEX "race_courses_edition_status_idx" ON "race_courses" USING btree ("race_edition_id","status");--> statement-breakpoint
CREATE INDEX "race_courses_distance_idx" ON "race_courses" USING btree ("distance_km");--> statement-breakpoint
CREATE UNIQUE INDEX "race_courses_source_external_unique" ON "race_courses" USING btree ("source_provider","external_id");--> statement-breakpoint
CREATE INDEX "race_editions_event_start_idx" ON "race_editions" USING btree ("race_event_id","start_date");--> statement-breakpoint
CREATE INDEX "race_editions_status_start_idx" ON "race_editions" USING btree ("status","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "race_editions_source_external_unique" ON "race_editions" USING btree ("source_provider","external_id");--> statement-breakpoint
CREATE INDEX "race_events_status_name_idx" ON "race_events" USING btree ("status","name");--> statement-breakpoint
CREATE UNIQUE INDEX "race_events_source_external_unique" ON "race_events" USING btree ("source_provider","external_id");--> statement-breakpoint
CREATE INDEX "training_goal_race_courses_course_idx" ON "training_goal_race_courses" USING btree ("race_course_id");