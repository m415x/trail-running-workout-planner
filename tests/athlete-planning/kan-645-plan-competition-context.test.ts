import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readAthletePlanCompetitionMilestones } from '@/lib/athlete-planning/plan-competition-context'

const registration = {
  registrationId: 'registration-1',
  raceCourseId: 'course-1',
  eventName: 'Mountain Race',
  editionLabel: '2026',
  editionDate: '2026-11-08',
  courseLabel: '21 km',
  nominalDistanceKm: 21,
  nominalElevationGainM: 850,
  participationStatus: 'unknown' as const,
  actualDistanceKm: null,
  elapsedTimeSeconds: null,
}

describe('KAN-645/T6 — authorized Competition milestones without inferred plan goals', () => {
  it('keeps registered races as factual milestones, never inferred objectives', async () => {
    const result = await readAthletePlanCompetitionMilestones({
      readSelfRegistrations: async () => ({ status: 'loaded' as const, data: { upcoming: [registration], history: [] } }),
      explicitPlanGoalRegistrationIds: [],
    })
    assert.deepEqual(result, {
      status: 'loaded',
      milestones: [{ ...registration, kind: 'registration' }],
    })
  })

  it('labels an objective only for an explicit planning relationship', async () => {
    const result = await readAthletePlanCompetitionMilestones({
      readSelfRegistrations: async () => ({ status: 'loaded' as const, data: { upcoming: [registration], history: [] } }),
      explicitPlanGoalRegistrationIds: ['registration-1'],
    })
    assert.equal(result.status, 'loaded')
    if (result.status !== 'loaded') return
    assert.equal(result.milestones[0].kind, 'explicit-plan-goal')
  })

  it('preserves SELF denied and error outcomes without leaking registrations as empty', async () => {
    for (const status of ['denied', 'error'] as const) {
      assert.deepEqual(await readAthletePlanCompetitionMilestones({
        readSelfRegistrations: async () => ({ status }),
        explicitPlanGoalRegistrationIds: [],
      }), { status })
    }
  })

  it('keeps a genuinely empty authorized registration set distinct', async () => {
    assert.deepEqual(await readAthletePlanCompetitionMilestones({
      readSelfRegistrations: async () => ({ status: 'loaded' as const, data: { upcoming: [], history: [] } }),
      explicitPlanGoalRegistrationIds: [],
    }), { status: 'loaded', milestones: [] })
  })
})
