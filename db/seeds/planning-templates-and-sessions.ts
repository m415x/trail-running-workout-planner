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
 * Owns the canonical S2 planning hierarchy used by the composable seed.
 *
 * The legacy base-seed block still enriches this same hierarchy with load,
 * intensity and session-generation strategy fixtures. IDs therefore match the
 * canonical legacy hierarchy until that remaining ownership is extracted.
 */
export async function seedPlanningTemplatesAndSessions(
  db: SeedDb,
  groups: SeededAthleteGroup[],
  currentWeekStart: string,
  shiftISODate: (value: string, days: number) => string,
): Promise<void> {
  const s2GroupId = groupId(groups, 'S2')
  const planId = 'group_plan_s2_12k'
  const macrocycleId = 'macro_s2_12k'
  const generalMesocycleId = 'meso_s2_12k_general'
  const specificMesocycleId = 'meso_s2_12k_specific'

  await db.insert(groupTrainingPlans).values({
    id: planId,
    groupId: s2GroupId,
    title: 'Plan base S2 — Short Trail 12K',
    status: 'active',
    notes: 'Fixture de desarrollo para validar el flujo actual de planificación de Epic 2.',
  }).onConflictDoNothing().run()

  await db.insert(macrocycles).values({
    id: macrocycleId,
    title: 'Plan base S2 — Short Trail 12K',
    groupTrainingPlanId: planId,
    startDate: currentWeekStart,
    endDate: shiftISODate(currentWeekStart, 8 * 7 - 1),
    taperingWeeksCount: 2,
    targetRaceName: 'Short Trail 12K',
    targetRaceDistanceKm: 12,
    targetRaceElevationGain: 600,
    notes: null,
  }).onConflictDoNothing().run()

  await db.insert(mesocycles).values([
    {
      id: generalMesocycleId,
      macrocycleId,
      title: 'Preparación general',
      number: 1,
      period: 'general_preparatory',
      objective: 'Consolidar base aeróbica y fuerza para esfuerzos cortos de trail.',
    },
    {
      id: specificMesocycleId,
      macrocycleId,
      title: 'Preparación específica y competencia',
      number: 2,
      period: 'competitive',
      objective: 'Aumentar especificidad, calidad y frescura para la carrera Short.',
    },
  ]).onConflictDoNothing().run()

  const weekDefinitions = [
    { type: 'base', targetVolumeKm: 36, targetElevationGain: 720 },
    { type: 'development', targetVolumeKm: 39.3, targetElevationGain: 786 },
    { type: 'development', targetVolumeKm: 39.3, targetElevationGain: 786 },
    { type: 'deload', targetVolumeKm: 27, targetElevationGain: 540 },
    { type: 'development', targetVolumeKm: 39.3, targetElevationGain: 786 },
    { type: 'shock', targetVolumeKm: 42, targetElevationGain: 840 },
    { type: 'tapering', targetVolumeKm: 25.2, targetElevationGain: 504 },
    { type: 'race', targetVolumeKm: 19.8, targetElevationGain: 600 },
  ] as const
  const microcycleRows = weekDefinitions.map(({ type, targetVolumeKm, targetElevationGain }, index) => ({
    id: `s2_12k_micro_${index + 1}`,
    mesocycleId: index < 4 ? generalMesocycleId : specificMesocycleId,
    weekNumber: index + 1,
    type,
    startDate: shiftISODate(currentWeekStart, index * 7),
    endDate: shiftISODate(currentWeekStart, index * 7 + 6),
    targetVolumeKm,
    targetVolumeSource: 'generated' as const,
    targetElevationGain,
    targetElevationSource: 'generated' as const,
    targetDurationMin: null,
    notes: null,
  }))

  await db.insert(microcycles).values(microcycleRows).onConflictDoNothing().run()

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
