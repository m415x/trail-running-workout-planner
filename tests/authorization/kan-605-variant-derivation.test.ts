import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/planning-cohort-actions.ts', 'utf8')
const start = source.indexOf('export async function derivePlanningCohortVariantAction(')
const end = source.indexOf('export async function createPlanningCohort(', start)
assert.ok(start !== -1 && end > start)
const action = source.slice(start, end)

describe('KAN-673 H4B Base to Variant derivation authorization RED', () => {
  it('authenticates H2 and derives active Team server-side before persistence', () => {
    assert.match(action, /requirePlanningContext\(/)
    assert.doesNotMatch(action, /CURRENT_TEAM_ID/)
    assert.match(action, /planningContext\.teamId/)
  })

  it('requires planning.manage coverage for both persisted cohort group and source Base plan group', () => {
    assert.match(action, /authorizeGroup\(/)
    assert.match(action, /reviewedBasePlan\.groupId/)
    assert.match(action, /reviewedBasePlan\.group\.teamId/)
    const groupAuthorization = action.indexOf('authorizeGroup(')
    const persist = action.indexOf('persistPlanningCohortVariantSynchronously(')
    assert.ok(groupAuthorization !== -1 && persist > groupAuthorization)
  })

  it('preserves reviewed source snapshot, competition selection, and single-variant invariant', () => {
    assert.match(action, /context\.cohort\.status !== 'active'/)
    assert.match(action, /context\.cohort\.planningVariant/)
    assert.match(action, /context\.basePlans\.find/)
    assert.match(action, /competitionsBelongToBasePlan/)
    assert.match(action, /selectedCompetitionEntryIds/)
  })
})
