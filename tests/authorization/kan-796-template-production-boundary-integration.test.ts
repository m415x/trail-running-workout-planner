import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const actionSource = readFileSync('app/actions/workout-template-actions.ts', 'utf8')
const isolatedBoundary = readFileSync('lib/workout-templates/authorized-workout-template-operations.ts', 'utf8')
const composition = readFileSync('lib/workout-templates/workout-template-action-composition.ts', 'utf8')
const navigation = readFileSync('lib/authorization/coach-navigation-policy.ts', 'utf8')

/**
 * T4 RED: previous T2 SQLite tests exercise an injected repository adapter,
 * while production Server Actions currently implement a separate boundary.
 * The shared fail-closed Team resolver is required at both call sites.
 * This source test alone does not establish real HTTP/SQLite writer coverage.
 */
test('KAN-796 production and disposable SQLite operations use one fail-closed Team authority core', () => {
  assert.match(isolatedBoundary, /export async function resolveAuthorizedWorkoutTemplateTeam\(/)
  assert.match(isolatedBoundary, /const authorizedTeam = \(\) => resolveAuthorizedWorkoutTemplateTeam\(deps\)/)
  assert.match(actionSource, /createWorkoutTemplateActionComposition/)
  assert.match(composition, /resolveAuthorizedWorkoutTemplateTeam\(freshAuthorization\(\)\)/)
  assert.match(composition, /requireAuthenticatedEptAction\(/)
  assert.match(actionSource, /createH4aNextServerAuthorizationBoundary\(\)\.authorize\(access,/)
})

test('KAN-796 production keeps fail-closed Team and navigation contracts', () => {
  assert.doesNotMatch(actionSource, /CURRENT_TEAM_ID\s*=\s*'team_1'/)
  assert.match(actionSource, /createH4aNextServerAuthorizationBoundary/)
  assert.match(actionSource, /readEptSessionAccessState/)
  assert.match(navigation, /href: '\/dashboard\/templates', visibility: \{ kind: 'hidden' \}/)
})
