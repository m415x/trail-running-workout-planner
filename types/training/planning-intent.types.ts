/**
 * General training direction pursued by a group training plan.
 *
 * Competition is intentionally excluded: race-specific adaptation belongs to
 * competition context rather than to the plan's general intent.
 */
export type PlanningIntent = 'development' | 'base' | 'maintenance'
