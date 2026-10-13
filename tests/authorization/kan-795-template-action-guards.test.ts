import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const actions = readFileSync('app/actions/workout-template-actions.ts', 'utf8')
const planningPreview = readFileSync('app/[locale]/dashboard/planning/[planId]/page.tsx', 'utf8')
const navigation = readFileSync('lib/authorization/coach-navigation-policy.ts', 'utf8')

function operationBody(name: string): string {
  const start = actions.indexOf(`export async function ${name}(`)
  assert.ok(start >= 0, `Missing production action ${name}`)
  const end = actions.indexOf('\nexport async function ', start + 1)
  return actions.slice(start, end < 0 ? undefined : end)
}

test('KAN-795 every production template read and write revalidates server-owned Team and H4A capability', () => {
  const names = [
    'getWorkoutTemplates',
    'getWorkoutTemplateById',
    'getWorkoutTemplateFormOptions',
    'createWorkoutTemplate',
    'updateWorkoutTemplate',
    'duplicateWorkoutTemplate',
    'setWorkoutTemplateArchiveStatus',
  ]
  assert.doesNotMatch(actions, /CURRENT_TEAM_ID\s*=\s*'team_1'/)
  assert.match(actions, /requireAuthenticatedEptAction/)
  assert.match(actions, /createH4aNextServerAuthorizationBoundary/)
  for (const name of names) {
    assert.match(operationBody(name), /authorizeWorkoutTemplateAccess\(/,
      `${name}: missing request-scoped H2/H3/H4A authorization before reading or writing`)
  }
})

test('KAN-795 client-provided Team cannot select catalog authority or reassign workout ownership', () => {
  const list = operationBody('getWorkoutTemplates')
  assert.doesNotMatch(list, /teamId:\s*string\s*=/,
    'Server Action must not expose a Team selector for a client-controlled caller')
  assert.match(actions, /eq\(workouts\.teamId,\s*teamId\)/)
  assert.match(actions, /teamId:\s*authorized\.teamId/,
    'Writes must use trusted authorization result to own the template')
  assert.match(planningPreview, /getWorkoutTemplates\(\{ archive: 'active' \}\)/,
    'Planning preview must use its own authorized server context; no client Team override')
})

test('KAN-795 fail-closed Coach Templates navigation remains hidden through the authority correction', () => {
  assert.match(navigation, /href: '\/dashboard\/templates', visibility: \{ kind: 'hidden' \}/)
})
