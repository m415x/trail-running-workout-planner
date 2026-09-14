CREATE TABLE "workout_log_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"workout_log_id" text NOT NULL,
	"corrected_by_user_id" text NOT NULL,
	"corrected_at" text NOT NULL,
	"reason" text,
	"before_snapshot" jsonb NOT NULL,
	"after_snapshot" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_log_corrections" ADD CONSTRAINT "workout_log_corrections_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_log_corrections" ADD CONSTRAINT "workout_log_corrections_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_log_corrections_log_date_idx" ON "workout_log_corrections" USING btree ("workout_log_id","corrected_at");--> statement-breakpoint
CREATE INDEX "workout_log_corrections_actor_date_idx" ON "workout_log_corrections" USING btree ("corrected_by_user_id","corrected_at");
--> statement-breakpoint
ALTER TABLE "workout_log_corrections" ENABLE ROW LEVEL SECURITY;