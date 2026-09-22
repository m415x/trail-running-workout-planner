import type { db as sqliteDb } from '@/db/index'
import { planningCohortMemberships, planningCohorts } from '@/db/schema'
import { createSeedContext } from '@/db/seeds/context'

import type { SeededAthleteGroup } from '@/db/seeds/groups'

type SeedDb = typeof sqliteDb

function groupId(groups: SeededAthleteGroup[], code: string): string {
  const group = groups.find((candidate) => `${candidate.categoryCode}${candidate.levelCode}` === code)
  if (!group) throw new Error(`Missing seed group dependency: ${code}`)
  return group.id
}

export async function seedCohorts(
  db: SeedDb,
  groups: SeededAthleteGroup[],
  currentWeekStart: string,
  shiftISODate: (value: string, days: number) => string,
): Promise<void> {
  const { teamId, athleteProfileId: currentAthleteProfileId } = createSeedContext()

  await db.insert(planningCohorts).values([
    {
      id: 'planning_cohort_s2_short_trail',
      teamId,
      groupId: groupId(groups, 'S2'),
      name: 'Short Trail primavera',
      purpose: 'Preparar una carrera corta de trail con un horizonte compartido.',
      description: 'Cohorte activa para validar integrantes vigentes e históricos.',
      status: 'active',
    },
    {
      id: 'planning_cohort_m1_archived',
      teamId,
      groupId: groupId(groups, 'M1'),
      name: 'Maratón de montaña 2025',
      purpose: 'Conservar la planificación histórica de una cohorte finalizada.',
      description: null,
      status: 'archived',
    },
  ]).onConflictDoNothing().run()

  await db.insert(planningCohortMemberships).values([
    {
      id: 'cohort_membership_current_athlete',
      planningCohortId: 'planning_cohort_s2_short_trail',
      athleteProfileId: currentAthleteProfileId,
      startDate: currentWeekStart,
      endDate: null,
      assignedByUserId: null,
      assignmentReason: 'Objetivo Short Trail compartido.',
      endedByUserId: null,
      endReason: null,
    },
    {
      id: 'cohort_membership_ana',
      planningCohortId: 'planning_cohort_s2_short_trail',
      athleteProfileId: 'profile_user_2',
      startDate: currentWeekStart,
      endDate: null,
      assignedByUserId: null,
      assignmentReason: 'Objetivo Short Trail compartido.',
      endedByUserId: null,
      endReason: null,
    },
    {
      id: 'cohort_membership_bruno_history',
      planningCohortId: 'planning_cohort_s2_short_trail',
      athleteProfileId: 'profile_user_3',
      startDate: shiftISODate(currentWeekStart, -8 * 7),
      endDate: shiftISODate(currentWeekStart, -1),
      assignedByUserId: null,
      assignmentReason: 'Preparación compartida del bloque anterior.',
      endedByUserId: null,
      endReason: 'Objetivo completado.',
    },
  ]).onConflictDoNothing().run()
}
