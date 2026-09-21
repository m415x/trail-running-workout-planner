CREATE TABLE "field_performance_test_events" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"team_id" text NOT NULL,
	"group_id" text NOT NULL,
	"scheduled_at" text NOT NULL,
	"protocol" text NOT NULL,
	"created_by_user_id" text,
	CONSTRAINT "field_performance_test_events_protocol_check" CHECK ("field_performance_test_events"."protocol" = '1000m_track')
);
--> statement-breakpoint
ALTER TABLE "field_performance_test_events" ADD CONSTRAINT "field_performance_test_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_performance_test_events" ADD CONSTRAINT "field_performance_test_events_group_id_athlete_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."athlete_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_performance_test_events" ADD CONSTRAINT "field_performance_test_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_performance_test_events_team_group_date_idx" ON "field_performance_test_events" USING btree ("team_id","group_id","scheduled_at");--> statement-breakpoint
ALTER TABLE "field_performance_tests" ADD CONSTRAINT "field_performance_tests_test_event_id_field_performance_test_events_id_fk" FOREIGN KEY ("test_event_id") REFERENCES "public"."field_performance_test_events"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "field_performance_test_events" ENABLE ROW LEVEL SECURITY;
