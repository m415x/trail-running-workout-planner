CREATE TABLE "external_identity_links" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_identity_links" ADD CONSTRAINT "external_identity_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_identity_links_provider_subject_unique" ON "external_identity_links" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "external_identity_links_user_idx" ON "external_identity_links" USING btree ("user_id");