ALTER TABLE "group_session_prescriptions" ADD COLUMN "generation_ownership" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_session_prescriptions" ADD COLUMN "generation_key" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "generation_ownership" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "shared_event_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "group_session_prescriptions_generation_key_unique" ON "group_session_prescriptions" USING btree ("generation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_shared_event_key_unique" ON "sessions" USING btree ("shared_event_key");