CREATE TABLE "global_monthly_due_date_exceptions" (
  "id" text PRIMARY KEY NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "team_id" text NOT NULL,
  "year" integer NOT NULL,
  "month" integer NOT NULL,
  "due_date" text NOT NULL,
  "reason" text NOT NULL,
  "is_current" boolean DEFAULT true NOT NULL,
  CONSTRAINT "global_monthly_due_date_exceptions_month_check" CHECK ("global_monthly_due_date_exceptions"."month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "monthly_charge_reductions" (
  "id" text PRIMARY KEY NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "monthly_charge_id" text NOT NULL,
  "reduction_amount_minor" integer NOT NULL,
  "reason" text NOT NULL,
  "is_current" boolean DEFAULT true NOT NULL,
  CONSTRAINT "monthly_charge_reductions_amount_check" CHECK ("monthly_charge_reductions"."reduction_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "monthly_charge_extensions" (
  "id" text PRIMARY KEY NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "monthly_charge_id" text NOT NULL,
  "extended_due_date" text,
  "reason" text NOT NULL,
  "is_current" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "global_monthly_due_date_exceptions" ADD CONSTRAINT "global_monthly_due_date_exceptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "monthly_charge_reductions" ADD CONSTRAINT "monthly_charge_reductions_monthly_charge_id_monthly_charges_id_fk" FOREIGN KEY ("monthly_charge_id") REFERENCES "public"."monthly_charges"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "monthly_charge_extensions" ADD CONSTRAINT "monthly_charge_extensions_monthly_charge_id_monthly_charges_id_fk" FOREIGN KEY ("monthly_charge_id") REFERENCES "public"."monthly_charges"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "global_monthly_due_date_exceptions_team_period_current_unique" ON "global_monthly_due_date_exceptions" USING btree ("team_id","year","month") WHERE "is_current" = true;
--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_charge_reductions_charge_current_unique" ON "monthly_charge_reductions" USING btree ("monthly_charge_id") WHERE "is_current" = true;
--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_charge_extensions_charge_current_unique" ON "monthly_charge_extensions" USING btree ("monthly_charge_id") WHERE "is_current" = true;
--> statement-breakpoint
ALTER TABLE "global_monthly_due_date_exceptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "monthly_charge_reductions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "monthly_charge_extensions" ENABLE ROW LEVEL SECURITY;
