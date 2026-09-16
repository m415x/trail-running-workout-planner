import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  raceRegistrationEditionKey,
  validateRaceRegistrationDraft,
} from '@/lib/competitions/race-registration'
import type { RaceRegistrationDraft } from '@/types/training/race-registration.types'

const draft = (overrides: Partial<RaceRegistrationDraft> = {}): RaceRegistrationDraft => ({
  id: 'registration_1',
  teamId: 'team_1',
  athleteProfileId: 'athlete_1',
  course: {
    raceEventId: 'event_1',
    raceEditionId: 'edition_2026',
    raceCourseId: 'course_30k',
  },
  registrationStatus: 'registered',
  ...overrides,
})

describe('race registration domain', () => {
  it('accepts one effective registration with explicit team, athlete and course identity', () => {
    assert.deepEqual(validateRaceRegistrationDraft(draft()), [])
  })

  it('rejects missing opaque registration, team, athlete or concrete course identity', () => {
    assert.deepEqual(
      validateRaceRegistrationDraft(
        draft({
          id: '',
          teamId: '',
          athleteProfileId: '',
          course: { raceEventId: '', raceEditionId: '', raceCourseId: '' },
        }),
      ),
      [
        'registration_id_required',
        'team_id_required',
        'athlete_profile_id_required',
        'race_event_id_required',
        'race_edition_id_required',
        'race_course_id_required',
      ],
    )
  })

  it('uses team + athlete + edition as the business uniqueness identity, independent of course', () => {
    const first = raceRegistrationEditionKey(draft())
    const changedCourse = raceRegistrationEditionKey(
      draft({
        course: {
          raceEventId: 'event_1',
          raceEditionId: 'edition_2026',
          raceCourseId: 'course_42k',
        },
      }),
    )

    assert.equal(first, changedCourse)
    assert.notEqual(
      first,
      raceRegistrationEditionKey(
        draft({
          course: {
            raceEventId: 'event_1',
            raceEditionId: 'edition_2027',
            raceCourseId: 'course_30k',
          },
        }),
      ),
    )
  })

  it('keeps registration lifecycle limited to effective registration facts', () => {
    assert.deepEqual(validateRaceRegistrationDraft(draft({ registrationStatus: 'cancelled' })), [])

    assert.equal('trainingGoalId' in draft(), false)
    assert.equal('competitionEntryId' in draft(), false)
    assert.equal('participationStatus' in draft(), false)
  })
})
