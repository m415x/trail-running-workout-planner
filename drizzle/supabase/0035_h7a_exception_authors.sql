ALTER TABLE "global_monthly_due_date_exceptions" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "global_monthly_due_date_exceptions" ADD CONSTRAINT "global_monthly_due_date_exceptions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "monthly_charge_reductions" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "monthly_charge_reductions" ADD CONSTRAINT "monthly_charge_reductions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "monthly_charge_extensions" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "monthly_charge_extensions" ADD CONSTRAINT "monthly_charge_extensions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;