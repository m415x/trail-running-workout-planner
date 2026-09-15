import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAthleteStatsCompetitionSource } from '@/lib/athlete-stats/athlete-stats-competition-source'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'

const scope = {
  athleteId: 'athlete-1',
  teamId: 'team-1',
  startDate: '2026-09-08',
  endDate: '2026-09-14',
}

const competition = {
  id: 'competition-1',
  groupTrainingPlanId: 'plan-1',
  name: 'Target Race',
  date: '2026-10-10',
  distanceKm: 21,
  elevationGainM: 900,
  priority: 'A',
  status: 'scheduled',
  isDeleted: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as CompetitionEntry

describe('athlete stats competition source', () => {
  it('reads only the calendar of the plan applicable at the stats period end', async () => {
    const calls: string[] = []
    const source = createAthleteStatsCompetitionSource({
      getAthletePlanningResolutionOnDate: async (athleteId, date) => {
        calls.push(`${athleteId}:${date}`)
        return { resolution: { status: 'resolved', planId: 'plan-1' } }
      },
      getCompetitionCalendar: planId => {
        calls.push(planId)
        return [competition]
      },
    })

    const context = await source.getCompetitionContext(scope)

    assert.deepEqual(calls, ['athlete-1:2026-09-14', 'plan-1'])
    assert.equal(context.primaryCompetition?.id, 'competition-1')
  })

  it('returns an empty valid context when no plan is applicable', async () => {
    let calendarRead = false
    const source = createAthleteStatsCompetitionSource({
      getAthletePlanningResolutionOnDate: async () => ({
        resolution: { status: 'none', reason: 'no-applicable-plan' },
      }),
      getCompetitionCalendar: () => { calendarRead = true; return [competition] },
    })

    const context = await source.getCompetitionContext(scope)

    assert.deepEqual(context, { primaryCompetition: null, intermediateCompetitions: [] })
    assert.equal(calendarRead, false)
  })

  it('fails closed on ambiguous planning instead of mixing calendars', async () => {
    const source = createAthleteStatsCompetitionSource({
      getAthletePlanningResolutionOnDate: async () => ({
        resolution: { status: 'conflict', reason: 'multiple-base-plans' },
      }),
      getCompetitionCalendar: () => [competition],
    })

    await assert.rejects(() => source.getCompetitionContext(scope), /planning conflict/)
  })
})
