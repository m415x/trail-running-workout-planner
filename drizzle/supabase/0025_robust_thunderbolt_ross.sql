CREATE TABLE "payment_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"payment_id" text NOT NULL,
	"monthly_charge_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"payment_method" text NOT NULL,
	"paid_at" text NOT NULL,
	"voided" boolean DEFAULT false NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	CONSTRAINT "payment_revisions_amount_positive_check" CHECK ("payment_revisions"."amount_minor" > 0),
	CONSTRAINT "payment_revisions_method_check" CHECK ("payment_revisions"."payment_method" in ('cash', 'bank_transfer'))
);
--> statement-breakpoint
ALTER TABLE "payment_revisions" ADD CONSTRAINT "payment_revisions_monthly_charge_id_monthly_charges_id_fk" FOREIGN KEY ("monthly_charge_id") REFERENCES "public"."monthly_charges"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "payment_revisions_monthly_charge_idx" ON "payment_revisions" USING btree ("monthly_charge_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_revisions_payment_current_unique" ON "payment_revisions" USING btree ("payment_id") WHERE "payment_revisions"."is_current" = true;
--> statement-breakpoint
ALTER TABLE "payment_revisions" ENABLE ROW LEVEL SECURITY;
