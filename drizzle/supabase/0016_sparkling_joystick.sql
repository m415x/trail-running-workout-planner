CREATE TABLE "race_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"team_id" text NOT NULL,
	"athlete_profile_id" text NOT NULL,
	"race_event_id" text NOT NULL,
	"race_edition_id" text NOT NULL,
	"race_course_id" text NOT NULL,
	"registration_status" text NOT NULL,
	"participation_status" text NOT NULL,
	"snapshot_event_name" text NOT NULL,
	"snapshot_edition_label" text NOT NULL,
	"snapshot_edition_date" text NOT NULL,
	"snapshot_course_label" text NOT NULL,
	"snapshot_nominal_distance_km" double precision,
	"snapshot_nominal_elevation_gain_m" double precision,
	"result_actual_distance_km" double precision,
	"result_elapsed_time_seconds" integer,
	CONSTRAINT "race_registrations_registration_status_check" CHECK ("race_registrations"."registration_status" in ('registered', 'cancelled')),
	CONSTRAINT "race_registrations_participation_status_check" CHECK ("race_registrations"."participation_status" in ('unknown', 'started', 'finished', 'dnf', 'dns')),
	CONSTRAINT "race_registrations_snapshot_nominal_distance_check" CHECK ("race_registrations"."snapshot_nominal_distance_km" is null or "race_registrations"."snapshot_nominal_distance_km" >= 0),
	CONSTRAINT "race_registrations_snapshot_nominal_elevation_check" CHECK ("race_registrations"."snapshot_nominal_elevation_gain_m" is null or "race_registrations"."snapshot_nominal_elevation_gain_m" >= 0),
	CONSTRAINT "race_registrations_result_actual_distance_check" CHECK ("race_registrations"."result_actual_distance_km" is null or "race_registrations"."result_actual_distance_km" >= 0),
	CONSTRAINT "race_registrations_result_elapsed_time_check" CHECK ("race_registrations"."result_elapsed_time_seconds" is null or "race_registrations"."result_elapsed_time_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "race_registrations" ADD CONSTRAINT "race_registrations_race_event_id_race_events_id_fk" FOREIGN KEY ("race_event_id") REFERENCES "public"."race_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_registrations" ADD CONSTRAINT "race_registrations_race_edition_id_race_editions_id_fk" FOREIGN KEY ("race_edition_id") REFERENCES "public"."race_editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_registrations" ADD CONSTRAINT "race_registrations_race_course_id_race_courses_id_fk" FOREIGN KEY ("race_course_id") REFERENCES "public"."race_courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "race_registrations_team_athlete_edition_unique" ON "race_registrations" USING btree ("team_id","athlete_profile_id","race_edition_id");--> statement-breakpoint
CREATE INDEX "race_registrations_team_athlete_idx" ON "race_registrations" USING btree ("team_id","athlete_profile_id");--> statement-breakpoint
CREATE INDEX "race_registrations_course_idx" ON "race_registrations" USING btree ("race_course_id");
--> statement-breakpoint
ALTER TABLE "race_registrations" ENABLE ROW LEVEL SECURITY;