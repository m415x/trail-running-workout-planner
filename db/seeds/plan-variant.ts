import type { db as sqliteDb } from '@/db/index'
import { groupTrainingPlans } from '@/db/schema'

type SeedDb = typeof sqliteDb

/** Cohort Variant is derived from the direct S2 Base, without effective sessions. */
export async function seedPlanVariant(db: SeedDb): Promise<void> {
  await db.insert(groupTrainingPlans).values({
    id: 'group_plan_s2_short_trail_variant',
    groupId: 'team_1_S2',
    planningCohortId: 'planning_cohort_s2_short_trail',
    sourceGroupTrainingPlanId: 'group_plan_s2_12k',
    title: 'Variante Short Trail — cohorte S2',
    status: 'draft',
    notes: 'Derivada del plan Base S2; sin sesiones efectivas.',
  }).onConflictDoNothing().run()
}
