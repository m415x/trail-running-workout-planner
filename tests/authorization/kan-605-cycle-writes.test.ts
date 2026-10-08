import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/planning-actions.ts', 'utf8')
const actions = [
  'saveLoadProgression',
  'updateMicrocycleVolume',
  'updateMicrocycleElevation',
  'updateMicrocycleDates',
  'updateMicrocycleType',
  'updateMicrocycleNotes',
] as const

function actionBody(name: string): string {
  const start = source.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, `Missing ${name}`)
  const next = source.indexOf('export async function ', start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

describe('KAN-670 H4B cycle/progression writes authorization RED', () => {
  it('replaces the fixed Team ownership gate with persisted plan Group ownership', () => {
    const ownership = source.slice(
      source.indexOf('function belongsToEditablePlan('),
      source.indexOf('export async function getGroupTrainingPlans('),
    )
    assert.doesNotMatch(ownership, /CURRENT_TEAM_ID/)
    assert.match(ownership, /group\.teamId/)
  })

  for (const name of actions) {
    it(`${name} requires authenticated H2 and planning.manage via H4A/H3 before writing`, () => {
      const action = actionBody(name)
      assert.doesNotMatch(action, /CURRENT_TEAM_ID/)
      assert.match(action, /requireAuthenticated|authorizePlanning|planningAuthorization|createH4bPlanningAuthorizationBoundary/)
      assert.match(action, /planning\.manage|createH4bPlanningAuthorizationBoundary|authorizePlanning/)
      assert.match(action, /if\s*\(!authenticated\)\s*return\s*\{\s*error:\s*'No autorizado'\s*\}/)
    })
  }

  it('the shared write helper checks persisted plan/group ownership and H3 allow before returning the H2 actor', () => {
    const helperStart = source.indexOf('async function authorizePlanningCycleWrite(')
    const helperEnd = source.indexOf('export async function getGroupTrainingPlans(', helperStart)
    assert.ok(helperStart !== -1 && helperEnd > helperStart)
    const helper = source.slice(helperStart, helperEnd)
    assert.match(helper, /requireAuthenticatedPlanningReadAccess/)
    assert.match(helper, /groupTrainingPlans\.id/)
    assert.match(helper, /plan\.group\.teamId\s*!==\s*authenticated\.teamId/)
    assert.match(helper, /planningAuthorization\.authorize\(/)
    assert.match(helper, /if\s*\(!decision\.allowed\)\s*return null/)
    assert.match(helper, /return authenticated\.access/)
  })

  it('microcycle modifications record H2 user rather than null provenance', () => {
    for (const name of actions.filter((name) => name.startsWith('updateMicrocycle'))) {
      const action = actionBody(name)
      assert.doesNotMatch(action, /changedByUserId:\s*null/)
      assert.match(action, /changedByUserId:\s*(?:access|authenticated)\.userId/)
    }
  })

  it('preserves manual changes and existing load/intensity progression protection', () => {
    assert.match(actionBody('updateMicrocycleVolume'), /targetVolumeSource:\s*'manual'/)
    assert.match(actionBody('updateMicrocycleElevation'), /targetElevationSource:/)
    assert.match(actionBody('saveLoadProgression'), /protectedMesocycles/)
    assert.match(actionBody('saveLoadProgression'), /persistProgression/)
    assert.match(actionBody('saveLoadProgression'), /persistIntensityPlanning/)
  })
})
