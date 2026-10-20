import type { db as sqliteDb } from '@/db/index'
import { groupTrainingPlans } from '@/db/schema'
import type { SeededAthleteGroup } from '@/db/seeds/groups'

type SeedDb = typeof sqliteDb

/** Cohort Variant is derived from the direct S2 Base, without effective sessions. */
export async function seedPlanVariant(db: SeedDb, groups: SeededAthleteGroup[]): Promise<void> {
  const s2 = groups.find((group) => group.categoryCode === 'S' && group.levelCode === '2')
  if (!s2) throw new Error('Missing S2 Base group for cohort Variant')
  await db.insert(groupTrainingPlans).values({
    id: 'group_plan_s2_short_trail_variant',
    groupId: s2.id,
    planningCohortId: 'planning_cohort_s2_short_trail',
    sourceGroupTrainingPlanId: 'group_plan_s2_12k',
    title: 'Variante Short Trail — cohorte S2',
    status: 'draft',
    notes: 'Derivada del plan Base S2; sin sesiones efectivas.',
  }).onConflictDoNothing().run()
}
