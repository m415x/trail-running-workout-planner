ALTER TABLE "field_performance_test_events" DROP CONSTRAINT "field_performance_test_events_created_by_user_id_users_id_fk";
ALTER TABLE "field_performance_test_events" ADD CONSTRAINT "field_performance_test_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
