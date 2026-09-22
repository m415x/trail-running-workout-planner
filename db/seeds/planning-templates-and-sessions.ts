import type { db as sqliteDb } from '@/db/index'
import { groupTrainingPlans, macrocycles, mesocycles, microcycles, sessions } from '@/db/schema'

import type { SeededAthleteGroup } from '@/db/seeds/groups'
import { createSeedContext } from '@/db/seeds/context'

type SeedDb = typeof sqliteDb

function groupId(groups: SeededAthleteGroup[], code: string): string {
  const group = groups.find((candidate) => `${candidate.categoryCode}${candidate.levelCode}` === code)
  if (!group) throw new Error(`Missing seed group dependency: ${code}`)
  return group.id
}

/**
 * Owns the planning/templates/sessions fixture boundary.
 *
 * KAN-426 extracts this domain incrementally from the legacy monolithic seed.
 * The initial slice establishes real plan, macrocycle, microcycle and session
 * rows with explicit group and date dependencies; richer strategy/template
 * data remains in the legacy seed until its own extraction step.
 */
export async function seedPlanningTemplatesAndSessions(
  db: SeedDb,
  groups: SeededAthleteGroup[],
  currentWeekStart: string,
  shiftISODate: (value: string, days: number) => string,
): Promise<void> {
  const s2GroupId = groupId(groups, 'S2')
  const planId = 'group_plan_s2_seed_fixture'
  const macrocycleId = 'macro_s2_seed_fixture'
  const mesocycleId = 'meso_s2_seed_fixture_base'
  const microcycleId = 'micro_s2_seed_fixture_1'

  await db.insert(groupTrainingPlans).values({
    id: planId,
    groupId: s2GroupId,
    title: 'Plan base S2 — Short Trail 12K',
    status: 'active',
    notes: 'Composable development fixture.',
  }).onConflictDoNothing().run()

  await db.insert(macrocycles).values({
    id: macrocycleId,
    title: 'Plan base S2 — Short Trail 12K',
    groupTrainingPlanId: planId,
    startDate: currentWeekStart,
    endDate: shiftISODate(currentWeekStart, 7),
    taperingWeeksCount: 2,
    targetRaceName: 'Short Trail 12K',
    targetRaceDistanceKm: 12,
    targetRaceElevationGain: 600,
    notes: null,
  }).onConflictDoNothing().run()

  await db.insert(mesocycles).values({
    id: mesocycleId,
    macrocycleId,
    title: 'Preparación general',
    number: 1,
    period: 'general_preparatory',
    objective: 'Construir base aeróbica para el fixture S2.',
  }).onConflictDoNothing().run()

  await db.insert(microcycles).values({
    id: microcycleId,
    mesocycleId,
    weekNumber: 1,
    type: 'base',
    startDate: currentWeekStart,
    endDate: shiftISODate(currentWeekStart, 6),
    targetVolumeKm: 20,
    targetVolumeSource: 'generated',
    targetElevationGain: 500,
    targetElevationSource: 'generated',
    targetDurationMin: null,
    notes: null,
  }).onConflictDoNothing().run()

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
