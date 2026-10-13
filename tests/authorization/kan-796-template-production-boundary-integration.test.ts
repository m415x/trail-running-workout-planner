import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const actionSource = readFileSync('app/actions/workout-template-actions.ts', 'utf8')
const isolatedBoundary = readFileSync('lib/workout-templates/authorized-workout-template-operations.ts', 'utf8')
const navigation = readFileSync('lib/authorization/coach-navigation-policy.ts', 'utf8')

/**
 * T4 RED: previous T2 SQLite tests exercise an injected repository adapter,
 * while production Server Actions currently implement a separate boundary.
 * Until the boundary is shared, their tests do not prove the real writer path.
 */
test('KAN-796 production template actions reuse the SQLite-tested authorization boundary', () => {
  assert.match(isolatedBoundary, /export function createAuthorizedWorkoutTemplateOperations\(/)
  assert.match(actionSource, /import\s*\{\s*createAuthorizedWorkoutTemplateOperations\s*\}\s*from\s*['"]@\/lib\/workout-templates\/authorized-workout-template-operations['"]/,
    'The SQLite-tested authorized operations must be connected to the real Server Action layer')
  assert.match(actionSource, /createAuthorizedWorkoutTemplateOperations\(/,
    'A boundary import alone does not protect production reads and writes')
})

test('KAN-796 production keeps fail-closed Team and navigation contracts', () => {
  assert.doesNotMatch(actionSource, /CURRENT_TEAM_ID\s*=\s*'team_1'/)
  assert.match(actionSource, /createH4aNextServerAuthorizationBoundary/)
  assert.match(actionSource, /readEptSessionAccessState/)
  assert.match(navigation, /href: '\/dashboard\/templates', visibility: \{ kind: 'hidden' \}/)
})
