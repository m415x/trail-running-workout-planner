CREATE TABLE "team_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"preset" text NOT NULL,
	"effective_from" text NOT NULL,
	"effective_until" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "team_memberships_date_order_check" CHECK ("team_memberships"."effective_until" is null or "team_memberships"."effective_until" > "team_memberships"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_memberships_user_team_dates_idx" ON "team_memberships" USING btree ("user_id","team_id","effective_from","effective_until");