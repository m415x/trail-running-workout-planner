import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateCompetitionCalendarMutation } from '@/lib/periodization/competition-calendar-policy'
import type { CompetitionEntry, CompetitionEntryDraft } from '@/types/training/competition-entry.types'

const macrocycles = [
  { id: 'macro-1', startDate: '2027-01-01', endDate: '2027-06-30' },
  { id: 'macro-2', startDate: '2027-07-01', endDate: '2027-12-31' },
]

function draft(overrides: Partial<CompetitionEntryDraft> = {}): CompetitionEntryDraft {
  return {
    groupTrainingPlanId: 'plan-1',
    name: 'Patagonia Run 42K',
    date: '2027-04-12',
    distanceKm: 42,
    elevationGainM: 2100,
    priority: 'A',
    status: 'planned',
    description: null,
    ...overrides,
  }
}

function existing(overrides: Partial<CompetitionEntry> = {}): CompetitionEntry {
  return {
    id: 'competition-1',
    groupTrainingPlanId: 'plan-1',
    name: 'Preparatory race',
    date: '2027-03-15',
    distanceKm: 21,
    elevationGainM: 900,
    priority: 'B',
    status: 'confirmed',
    description: null,
    isDeleted: false,
    ...overrides,
  }
}

describe('competition calendar mutation policy', () => {
  it('accepts a valid competition inside the plan horizon', () => {
    const result = validateCompetitionCalendarMutation({
      draft: draft(),
      planKind: 'cohort_variant',
      coversEntirePlanAudience: true,
      macrocycles,
      existingCompetitions: [],
    })

    assert.deepEqual(result, { valid: true, sameDateCompetitionIds: [] })
  })

  it('reports same-day entries without rejecting them automatically', () => {
    const result = validateCompetitionCalendarMutation({
      draft: draft({ priority: 'B' }),
      planKind: 'cohort_variant',
      coversEntirePlanAudience: true,
      macrocycles,
      existingCompetitions: [existing({ date: '2027-04-12' })],
    })

    assert.equal(result.valid, true)
    assert.deepEqual(result.sameDateCompetitionIds, ['competition-1'])
  })

  it('rejects a competition outside every macrocycle in the plan horizon', () => {
    const result = validateCompetitionCalendarMutation({
      draft: draft({ date: '2028-01-10' }),
      planKind: 'cohort_variant',
      coversEntirePlanAudience: true,
      macrocycles,
      existingCompetitions: [],
    })

    assert.equal(result.valid, false)
    if (!result.valid) assert.ok(result.errors.includes('competition_calendar_outside_plan_horizon'))
  })

  it('rejects partial audience ownership', () => {
    const result = validateCompetitionCalendarMutation({
      draft: draft(),
      planKind: 'group_base',
      coversEntirePlanAudience: false,
      macrocycles,
      existingCompetitions: [],
    })

    assert.equal(result.valid, false)
    if (!result.valid) assert.ok(result.errors.includes('competition_calendar_owner_invalid'))
  })

  it('rejects two active A competitions inside the same macrocycle horizon', () => {
    const result = validateCompetitionCalendarMutation({
      draft: draft(),
      planKind: 'cohort_variant',
      coversEntirePlanAudience: true,
      macrocycles,
      existingCompetitions: [existing({ priority: 'A', date: '2027-05-20' })],
    })

    assert.equal(result.valid, false)
    if (!result.valid) {
      assert.ok(result.errors.includes('competition_calendar_multiple_primary_candidates'))
    }
  })

  it('allows active A competitions in different macrocycle horizons', () => {
    const result = validateCompetitionCalendarMutation({
      draft: draft(),
      planKind: 'cohort_variant',
      coversEntirePlanAudience: true,
      macrocycles,
      existingCompetitions: [existing({ priority: 'A', date: '2027-10-20' })],
    })

    assert.equal(result.valid, true)
  })

  it('ignores cancelled, completed, deleted and current edited entries for A conflicts', () => {
    const result = validateCompetitionCalendarMutation({
      draft: draft(),
      planKind: 'cohort_variant',
      coversEntirePlanAudience: true,
      macrocycles,
      currentCompetitionId: 'competition-current',
      existingCompetitions: [
        existing({ id: 'competition-current', priority: 'A' }),
        existing({ id: 'cancelled', priority: 'A', status: 'cancelled' }),
        existing({ id: 'completed', priority: 'A', status: 'completed' }),
        existing({ id: 'deleted', priority: 'A', isDeleted: true }),
      ],
    })

    assert.equal(result.valid, true)
  })
})
