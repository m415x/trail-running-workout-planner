import type { db as sqliteDb } from '@/db/index'
import { sessions } from '@/db/schema'

import type { SeededAthleteGroup } from '@/db/seeds/groups'
import { createSeedContext } from '@/db/seeds/context'

type SeedDb = typeof sqliteDb

/**
 * Owns the composable planning/templates/sessions fixture boundary.
 *
 * The canonical development planning hierarchy is still created by the legacy
 * base-seed block until that richer strategy/template ownership is extracted.
 * This fixture must not create a second active plan hierarchy for the same
 * group/date while both paths coexist.
 */
export async function seedPlanningTemplatesAndSessions(
  db: SeedDb,
  _groups: SeededAthleteGroup[],
  currentWeekStart: string,
  _shiftISODate: (value: string, days: number) => string,
): Promise<void> {
  await db.insert(sessions).values({
    id: 'session_s2_seed_fixture',
    teamId: createSeedContext().teamId,
    workoutId: null,
    date: currentWeekStart,
    title: 'Entrenamiento',
    type: 'Base',
    locationKey: null,
    trackPath: null,
    structure: null,
    notes: null,
    generationOwnership: 'manual',
    sharedEventKey: null,
  }).onConflictDoNothing().run()
}
