import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

const actions = readFileSync(resolve('app/actions/workout-template-actions.ts'), 'utf8')
const navigation = readFileSync(resolve('lib/authorization/coach-navigation-policy.ts'), 'utf8')
const catalog = readFileSync(resolve('lib/authorization/capability-catalog.ts'), 'utf8')

const operations = [
  'getWorkoutTemplates',
  'getWorkoutTemplateById',
  'getWorkoutTemplateFormOptions',
  'createWorkoutTemplate',
  'updateWorkoutTemplate',
  'duplicateWorkoutTemplate',
  'setWorkoutTemplateArchiveStatus',
] as const

test('KAN-688/T1 existing H3 capability is selected without inventing a template-specific grant', () => {
  assert.match(catalog, /key: 'planning\.manage'/)
  assert.match(catalog, /key: 'training\.coordinate'/)
  assert.doesNotMatch(catalog, /key: 'templates\.manage'/)
  // KAN-682 remains fail-closed until the whole authorization vertical is accepted.
  assert.match(navigation, /href: '\/dashboard\/templates', visibility: \{ kind: 'hidden' \}/)
})

test('KAN-688/T1 all seven template entry points have a server-owned H2/H3/H4A authority boundary', () => {
  assert.doesNotMatch(actions, /CURRENT_TEAM_ID\s*=\s*'team_1'/,
    'The fixed fixture Team cannot authorize any template operation')
  assert.match(actions, /requireAuthenticatedEptAction|requireAuthenticatedPlanningReadAccess/,
    'H2 must be resolved in the server action, not in a route visibility check')
  assert.match(actions, /createActiveTeamNextServerContext|createH4aActiveTeamAuthorizationBoundary/,
    'H3 active Team must be resolved server-side')
  assert.match(actions, /createH4aNextServerAuthorizationBoundary/,
    'H4A effective capability must be enforced server-side')
  assert.match(actions, /capability:\s*'planning\.manage'/,
    'Use existing non-delegable planning capability, without inventing another authority')
  for (const operation of operations) {
    assert.match(actions, new RegExp(`export async function ${operation}\\s*\\(`),
      `Missing required template entry point: ${operation}`)
  }
})

test('KAN-688/T1 no public teamId argument can choose catalogue ownership', () => {
  assert.doesNotMatch(actions, /getWorkoutTemplates\(\s*criteria:[\s\S]*?teamId:\s*string\s*=/,
    'Catalogue source must derive authorized active Team, not accept an arbitrary client teamId')
  assert.match(actions, /eq\(workouts\.teamId,\s*teamId\)/,
    'Repository Team predicate must remain in place')
})
