DROP INDEX `group_session_prescriptions_session_group_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `group_session_prescriptions_session_microcycle_unique`
ON `group_session_prescriptions` (`session_id`, `microcycle_id`);
