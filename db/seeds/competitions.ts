import type { db as sqliteDb } from '@/db/index'
import { fieldPerformanceTestEvents } from '@/db/schema'
import { team } from '@/data/data'

import type { SeededAthleteGroup } from '@/db/seeds/groups'

type SeedDb = typeof sqliteDb

function groupId(groups: SeededAthleteGroup[], code: string): string {
  const group = groups.find((candidate) => `${candidate.categoryCode}${candidate.levelCode}` === code)
  if (!group) throw new Error(`Missing seed group dependency: ${code}`)
  return group.id
}

export async function seedCompetitions(
  db: SeedDb,
  groups: SeededAthleteGroup[],
  currentWeekStart: string,
  shiftISODate: (value: string, days: number) => string,
): Promise<void> {
  const teamId = String(team.id || 'team_1')

  await db
    .insert(fieldPerformanceTestEvents)
    .values({
      id: 'field_test_event_s2_1000m_current',
      teamId,
      groupId: groupId(groups, 'S2'),
      scheduledAt: `${shiftISODate(currentWeekStart, 3)}T18:00:00-03:00`,
      protocol: '1000m_track',
      createdByUserId: null,
    })
    .onConflictDoNothing()
    .run()
}
