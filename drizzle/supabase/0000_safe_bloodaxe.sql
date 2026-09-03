CREATE TABLE "athlete_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"category_code" text NOT NULL,
	"level_code" text NOT NULL,
	"team_id" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"group_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"nick_name" text,
	"dni" text NOT NULL,
	"birthday" text,
	"phone" text,
	"emergency_contact" text,
	"emergency_phone" text,
	"physiology" jsonb,
	"medical" jsonb,
	CONSTRAINT "athlete_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "group_history_records" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"athlete_id" text NOT NULL,
	"date" text NOT NULL,
	"previous_group_id" text,
	"new_group_id" text NOT NULL,
	"changed_by_user_id" text,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "group_session_prescriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"session_id" text NOT NULL,
	"group_id" text NOT NULL,
	"microcycle_id" text NOT NULL,
	"distance_km" double precision,
	"duration_min" integer,
	"elevation_gain" integer,
	"intensity_method" text,
	"zone" text,
	"pam_percentage" double precision,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "group_training_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "macrocycles" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"title" text NOT NULL,
	"group_training_plan_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"tapering_weeks_count" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"athlete_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"amount" double precision NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "mesocycles" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"macrocycle_id" text NOT NULL,
	"title" text NOT NULL,
	"number" integer NOT NULL,
	"period" text NOT NULL,
	"objective" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "microcycles" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"mesocycle_id" text NOT NULL,
	"week_number" integer NOT NULL,
	"type" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"target_volume_km" double precision,
	"target_elevation_gain" integer,
	"target_duration_min" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "physiology_records" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"athlete_id" text NOT NULL,
	"date" text NOT NULL,
	"pam_time_sec" integer NOT NULL,
	"pam_pace_formatted" text NOT NULL,
	"pam_speed_kmh" double precision,
	"max_hr" integer NOT NULL,
	"rest_hr" integer NOT NULL,
	"threshold_hr" integer,
	"weight_kg" double precision,
	"height_cm" double precision,
	"test_type" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "planning_modification_records" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_training_plan_id" text NOT NULL,
	"microcycle_id" text,
	"field" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"changed_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"team_id" text NOT NULL,
	"workout_id" text,
	"date" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"location_key" text,
	"track_path" text,
	"structure" jsonb,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "shoes" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"athlete_id" text NOT NULL,
	"type" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"max_km" double precision NOT NULL,
	"purchase_date" text,
	"current_km" double precision DEFAULT 0 NOT NULL,
	"retired_at" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar_light" text,
	"avatar_dark" text
);
--> statement-breakpoint
CREATE TABLE "training_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"athlete_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_date" text,
	"race_name" text,
	"race_distance_km" double precision,
	"race_elevation_gain" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "training_locations" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lon" double precision NOT NULL,
	"lat" double precision NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"role" text DEFAULT 'athlete' NOT NULL,
	"user_name" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"avatar" text,
	CONSTRAINT "users_user_name_unique" UNIQUE("user_name"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"athlete_id" text NOT NULL,
	"session_id" text,
	"workout_id" text,
	"date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"distance_km" double precision DEFAULT 0 NOT NULL,
	"duration_min" integer DEFAULT 0 NOT NULL,
	"elevation_gain" integer DEFAULT 0 NOT NULL,
	"avg_hr" integer,
	"feeling" text,
	"rpe" integer DEFAULT 0,
	"athlete_notes" text,
	"logged_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"zone" text DEFAULT 'Z2' NOT NULL,
	"distance" double precision DEFAULT 0 NOT NULL,
	"time" integer DEFAULT 0 NOT NULL,
	"gain" integer DEFAULT 0 NOT NULL,
	"pace" integer,
	"notes" text,
	"track_path" text,
	"location_key" text,
	"structure" jsonb
);
--> statement-breakpoint
ALTER TABLE "athlete_groups" ADD CONSTRAINT "athlete_groups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_group_id_athlete_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."athlete_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_history_records" ADD CONSTRAINT "group_history_records_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_history_records" ADD CONSTRAINT "group_history_records_previous_group_id_athlete_groups_id_fk" FOREIGN KEY ("previous_group_id") REFERENCES "public"."athlete_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_history_records" ADD CONSTRAINT "group_history_records_new_group_id_athlete_groups_id_fk" FOREIGN KEY ("new_group_id") REFERENCES "public"."athlete_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_history_records" ADD CONSTRAINT "group_history_records_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_session_prescriptions" ADD CONSTRAINT "group_session_prescriptions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_session_prescriptions" ADD CONSTRAINT "group_session_prescriptions_group_id_athlete_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."athlete_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_session_prescriptions" ADD CONSTRAINT "group_session_prescriptions_microcycle_id_microcycles_id_fk" FOREIGN KEY ("microcycle_id") REFERENCES "public"."microcycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_training_plans" ADD CONSTRAINT "group_training_plans_group_id_athlete_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."athlete_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "macrocycles" ADD CONSTRAINT "macrocycles_group_training_plan_id_group_training_plans_id_fk" FOREIGN KEY ("group_training_plan_id") REFERENCES "public"."group_training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_macrocycle_id_macrocycles_id_fk" FOREIGN KEY ("macrocycle_id") REFERENCES "public"."macrocycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microcycles" ADD CONSTRAINT "microcycles_mesocycle_id_mesocycles_id_fk" FOREIGN KEY ("mesocycle_id") REFERENCES "public"."mesocycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physiology_records" ADD CONSTRAINT "physiology_records_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_modification_records" ADD CONSTRAINT "planning_modification_records_group_training_plan_id_group_training_plans_id_fk" FOREIGN KEY ("group_training_plan_id") REFERENCES "public"."group_training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_modification_records" ADD CONSTRAINT "planning_modification_records_microcycle_id_microcycles_id_fk" FOREIGN KEY ("microcycle_id") REFERENCES "public"."microcycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_modification_records" ADD CONSTRAINT "planning_modification_records_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_location_key_training_locations_key_fk" FOREIGN KEY ("location_key") REFERENCES "public"."training_locations"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoes" ADD CONSTRAINT "shoes_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_goals" ADD CONSTRAINT "training_goals_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_location_key_training_locations_key_fk" FOREIGN KEY ("location_key") REFERENCES "public"."training_locations"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_groups_team_category_level_unique" ON "athlete_groups" USING btree ("team_id","category_code","level_code");--> statement-breakpoint
CREATE UNIQUE INDEX "group_session_prescriptions_session_group_unique" ON "group_session_prescriptions" USING btree ("session_id","group_id");
--> statement-breakpoint
ALTER TABLE "athlete_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "athlete_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_history_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_session_prescriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_training_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "macrocycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mesocycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "microcycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "physiology_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "planning_modification_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workouts" ENABLE ROW LEVEL SECURITY;
