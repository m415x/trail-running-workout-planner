import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildCourseRegistrationViewModel,
  parseBulkRegistrationSelection,
} from '@/lib/competitions/race-registration-course-ui'

describe('course-first registration UI contract', () => {
  it('builds selectable rows separately from contextual existing registrations', () => {
    const view = buildCourseRegistrationViewModel({
      interaction: {
        selectableAthletes: [
          { athleteProfileId: 'athlete-3', athleteName: 'Pedro' },
          { athleteProfileId: 'athlete-4', athleteName: 'Lucía' },
        ],
        alreadyRegistered: [
          { athleteProfileId: 'athlete-1', athleteName: 'Ana', courseLabel: '21K', relation: 'here' },
          { athleteProfileId: 'athlete-2', athleteName: 'Juan', courseLabel: '30K', relation: 'elsewhere' },
        ],
      },
      selectedAthleteProfileIds: ['athlete-4'],
    })

    assert.deepEqual(view.selectableRows, [
      { athleteProfileId: 'athlete-3', athleteName: 'Pedro', selected: false },
      { athleteProfileId: 'athlete-4', athleteName: 'Lucía', selected: true },
    ])
    assert.deepEqual(view.contextRows, [
      { athleteProfileId: 'athlete-1', athleteName: 'Ana', courseLabel: '21K', relation: 'here' },
      { athleteProfileId: 'athlete-2', athleteName: 'Juan', courseLabel: '30K', relation: 'elsewhere' },
    ])
    assert.equal(view.canSubmit, true)
  })

  it('accepts only currently selectable athlete ids from a submitted bulk selection', () => {
    const parsed = parseBulkRegistrationSelection({
      submittedAthleteProfileIds: ['athlete-3', 'athlete-2', 'athlete-3', 'unknown'],
      selectableAthleteProfileIds: ['athlete-3', 'athlete-4'],
    })

    assert.deepEqual(parsed, ['athlete-3'])
  })

  it('disables submission when no eligible athlete is selected', () => {
    const view = buildCourseRegistrationViewModel({
      interaction: {
        selectableAthletes: [{ athleteProfileId: 'athlete-3', athleteName: 'Pedro' }],
        alreadyRegistered: [],
      },
      selectedAthleteProfileIds: [],
    })

    assert.equal(view.canSubmit, false)
  })
})
