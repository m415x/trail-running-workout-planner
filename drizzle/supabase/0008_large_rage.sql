CREATE TABLE "session_generation_modification_records" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_training_plan_id" text NOT NULL,
	"session_id" text,
	"prescription_id" text,
	"action" text NOT NULL,
	"ownership" text NOT NULL,
	"generation_key" text,
	"previous_value" text,
	"new_value" text,
	"changed_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "session_generation_modification_records" ADD CONSTRAINT "session_generation_modification_records_group_training_plan_id_group_training_plans_id_fk" FOREIGN KEY ("group_training_plan_id") REFERENCES "public"."group_training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_generation_modification_records" ADD CONSTRAINT "session_generation_modification_records_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_generation_modification_records" ADD CONSTRAINT "session_generation_modification_records_prescription_id_group_session_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."group_session_prescriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_generation_modification_records" ADD CONSTRAINT "session_generation_modification_records_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;