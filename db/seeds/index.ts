import type { db as sqliteDb } from '@/db/index'

import { seedAthletes } from '@/db/seeds/athletes'
import { seedCohorts } from '@/db/seeds/cohorts'
import { seedCompetitions } from '@/db/seeds/competitions'
import { seedGroups } from '@/db/seeds/groups'
import { seedPlanningTemplatesAndSessions } from '@/db/seeds/planning-templates-and-sessions'
import { seedTeamAndCoach } from '@/db/seeds/team-and-coach'

type SeedDb = typeof sqliteDb

export type SeedFeature =
  | 'team-and-coach'
  | 'groups'
  | 'athletes'
  | 'competitions'
  | 'cohorts'
  | 'planning-templates-and-sessions'

export interface SeedTemporalContext {
  currentWeekStart: string
  shiftISODate: (value: string, days: number) => string
}

export async function seedFeature(
  db: SeedDb,
  feature: SeedFeature,
  temporal: SeedTemporalContext,
): Promise<void> {
  await seedTeamAndCoach(db)
  if (feature === 'team-and-coach') return

  const groups = await seedGroups(db)
  if (feature === 'groups') return

  await seedAthletes(db, groups)
  if (feature === 'athletes') return

  if (feature === 'competitions') {
    await seedCompetitions(db, groups, temporal.currentWeekStart, temporal.shiftISODate)
    return
  }

  if (feature === 'cohorts') {
    await seedCohorts(db, groups, temporal.currentWeekStart, temporal.shiftISODate)
    return
  }

  await seedPlanningTemplatesAndSessions(db, groups, temporal.currentWeekStart, temporal.shiftISODate)
}

export async function seedFull(db: SeedDb, temporal: SeedTemporalContext): Promise<void> {
  await seedTeamAndCoach(db)
  const groups = await seedGroups(db)
  await seedAthletes(db, groups)
  await seedCompetitions(db, groups, temporal.currentWeekStart, temporal.shiftISODate)
  await seedCohorts(db, groups, temporal.currentWeekStart, temporal.shiftISODate)
  await seedPlanningTemplatesAndSessions(db, groups, temporal.currentWeekStart, temporal.shiftISODate)
}
