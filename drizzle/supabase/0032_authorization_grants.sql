CREATE TABLE "authorization_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"beneficiary_user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"capability" text NOT NULL,
	"scope" text NOT NULL,
	"scope_target_id" text,
	"effective_from" text NOT NULL,
	"effective_until" text,
	"granted_by_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"revoked_at" text,
	"revoked_by_user_id" text,
	"revocation_reason" text,
	CONSTRAINT "authorization_grants_scope_check" CHECK ("authorization_grants"."scope" in ('self', 'sporting_group', 'team')),
	CONSTRAINT "authorization_grants_scope_target_check" CHECK (("authorization_grants"."scope" = 'sporting_group' and "authorization_grants"."scope_target_id" is not null) or ("authorization_grants"."scope" in ('self', 'team') and "authorization_grants"."scope_target_id" is null)),
	CONSTRAINT "authorization_grants_date_order_check" CHECK ("authorization_grants"."effective_until" is null or "authorization_grants"."effective_until" > "authorization_grants"."effective_from"),
	CONSTRAINT "authorization_grants_revocation_order_check" CHECK ("authorization_grants"."revoked_at" is null or "authorization_grants"."revoked_at" >= "authorization_grants"."effective_from"),
	CONSTRAINT "authorization_grants_revocation_metadata_check" CHECK (("authorization_grants"."revoked_at" is null and "authorization_grants"."revoked_by_user_id" is null and "authorization_grants"."revocation_reason" is null) or ("authorization_grants"."revoked_at" is not null and "authorization_grants"."revoked_by_user_id" is not null and "authorization_grants"."revocation_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "authorization_grants" ADD CONSTRAINT "authorization_grants_beneficiary_user_id_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "authorization_grants" ADD CONSTRAINT "authorization_grants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "authorization_grants" ADD CONSTRAINT "authorization_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "authorization_grants" ADD CONSTRAINT "authorization_grants_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "authorization_grants_beneficiary_team_dates_idx" ON "authorization_grants" USING btree ("beneficiary_user_id","team_id","effective_from","effective_until");
--> statement-breakpoint
CREATE INDEX "authorization_grants_team_capability_idx" ON "authorization_grants" USING btree ("team_id","capability");
