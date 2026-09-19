CREATE TABLE "field_performance_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"athlete_id" text NOT NULL,
	"performed_at" text NOT NULL,
	"protocol" text NOT NULL,
	"distance_m" integer NOT NULL,
	"elapsed_time_sec" double precision NOT NULL,
	"notes" text,
	CONSTRAINT "field_performance_tests_protocol_check" CHECK ("field_performance_tests"."protocol" = '1000m_track'),
	CONSTRAINT "field_performance_tests_distance_check" CHECK ("field_performance_tests"."distance_m" = 1000),
	CONSTRAINT "field_performance_tests_elapsed_time_check" CHECK ("field_performance_tests"."elapsed_time_sec" > 0)
);
--> statement-breakpoint
ALTER TABLE "field_performance_tests" ADD CONSTRAINT "field_performance_tests_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_performance_tests_athlete_date_idx" ON "field_performance_tests" USING btree ("athlete_id","performed_at");
--> statement-breakpoint
ALTER TABLE "field_performance_tests" ENABLE ROW LEVEL SECURITY;