import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/athlete-session-adjustment-actions.ts', 'utf8')

function action(name: string, following: string): string {
  const start = source.indexOf(`export async function ${name}(`)
  const end = source.indexOf(following, start)
  assert.ok(start >= 0 && end > start, `Missing boundary for ${name}`)
  return source.slice(start, end)
}

const review = action('getSessionAthleteAdjustmentReview', 'export async function saveAthleteSessionAdjustment(')
const save = action('saveAthleteSessionAdjustment', 'async function resolveEffectiveSourcePrescriptionId(')

describe('KAN-679 H4B athlete session adjustments authorization RED', () => {
  it('authenticates H2, resolves active Team and checks planning.manage', () => {
    assert.match(source, /requireAuthenticatedEptAction/)
    assert.match(source, /createActiveTeamNextServerContext/)
    assert.match(source, /planning\.manage/)
  })

  it('denies review unless every current session Sporting Group is covered', () => {
    assert.doesNotMatch(review, /CURRENT_TEAM_ID/)
    assert.match(review, /authorizeSessionAdjustment|planningAccess|authorizeAdjustmentReview/)
    assert.match(review, /groupSessionPrescriptions/)
  })

  it('denies revisions before persistence for partial session coverage or wrong Team', () => {
    assert.doesNotMatch(save, /CURRENT_TEAM_ID/)
    assert.match(save, /authorizeSessionAdjustment|planningAccess|authorizeAdjustmentWrite/)
    assert.match(save, /sourcePrescription/)
    const guard = save.search(/authorizeSessionAdjustment|authorizeAdjustmentWrite|planningAccess/)
    const write = save.indexOf('persistence.applyRevision(')
    assert.ok(guard >= 0 && write > guard, 'DENY must precede revision persistence')
  })

  it('attributes revisions to H2 and preserves append-only resolution', () => {
    assert.doesNotMatch(save, /changedByUserId:\s*null/)
    assert.match(save, /changedByUserId:\s*(?:access|planningAccess|authorization)\.userId/)
    assert.match(save, /resolveEffectiveSourcePrescriptionId/)
    assert.match(save, /createAthleteSessionAdjustmentPersistenceAdapter/)
    assert.match(save, /persistence\.applyRevision/)
  })
})
