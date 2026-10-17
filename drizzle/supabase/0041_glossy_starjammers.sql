CREATE TABLE "athlete_biometric_observations" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"athlete_profile_id" text NOT NULL,
	"kind" text NOT NULL,
	"value_scaled" integer NOT NULL,
	"unit" text NOT NULL,
	"observed_on" text NOT NULL,
	"recorded_at" text NOT NULL,
	"recorded_by_user_id" text NOT NULL,
	"source" text DEFAULT 'athlete_declared' NOT NULL,
	"supersedes_observation_id" text,
	"operation_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"correction_reason" text,
	CONSTRAINT "athlete_biometric_kind_value_unit_check" CHECK ((kind = 'weight' AND unit = 'kg' AND value_scaled BETWEEN 200 AND 3500) OR (kind = 'height' AND unit = 'cm' AND value_scaled BETWEEN 1000 AND 2500) OR (kind = 'max_hr' AND unit = 'bpm' AND value_scaled BETWEEN 60 AND 240) OR (kind = 'rest_hr' AND unit = 'bpm' AND value_scaled BETWEEN 25 AND 150)),
	CONSTRAINT "athlete_biometric_source_check" CHECK (source = 'athlete_declared'),
	CONSTRAINT "athlete_biometric_not_self_supersede_check" CHECK (supersedes_observation_id IS NULL OR supersedes_observation_id <> id)
);
--> statement-breakpoint
ALTER TABLE "athlete_biometric_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "athlete_biometric_observations" ADD CONSTRAINT "athlete_biometric_observations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_biometric_observations" ADD CONSTRAINT "athlete_biometric_observations_athlete_profile_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_profile_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_biometric_observations" ADD CONSTRAINT "athlete_biometric_observations_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_biometric_observations" ADD CONSTRAINT "athlete_biometric_observations_supersedes_observation_id_athlete_biometric_observations_id_fk" FOREIGN KEY ("supersedes_observation_id") REFERENCES "public"."athlete_biometric_observations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_biometric_operation_unique" ON "athlete_biometric_observations" USING btree ("team_id","athlete_profile_id","recorded_by_user_id","operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_biometric_single_successor_unique" ON "athlete_biometric_observations" USING btree ("supersedes_observation_id");--> statement-breakpoint
CREATE INDEX "athlete_biometric_effective_idx" ON "athlete_biometric_observations" USING btree ("team_id","athlete_profile_id","kind","observed_on","recorded_at","id");--> statement-breakpoint
CREATE INDEX "athlete_biometric_known_idx" ON "athlete_biometric_observations" USING btree ("team_id","athlete_profile_id","recorded_at");