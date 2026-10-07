import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/actions/athlete-actions.ts'),
  'utf8',
)

test('KAN-619 server action delegates athlete active-state changes through the team-scoped lifecycle boundary', () => {
  assert.match(
    source,
    /import\s+\{\s*setAthleteProfileActiveState\s*\}\s+from\s+['"]@\/lib\/athletes\/athlete-profile-lifecycle['"]/,
  )

  const start = source.indexOf('export async function setAthleteActiveState')
  const end = source.indexOf('export const assignAthleteToGroup', start)

  assert.notEqual(start, -1, 'setAthleteActiveState action must exist')
  assert.notEqual(end, -1, 'setAthleteActiveState action boundary must exist')

  const action = source.slice(start, end)

  assert.match(
    action,
    /setAthleteProfileActiveState\(db,\s*\{[\s\S]*?teamId:\s*authorizationResult\.teamId[\s\S]*?athleteId[\s\S]*?isActive/,
  )
  assert.match(
    action,
    /capability:\s*['"]athlete\.admin\.manage['"]/,
  )
  assert.match(
    action,
    /resource:\s*\{\s*teamId:\s*athlete\.teamId\s*\}/,
  )
  assert.doesNotMatch(
    action,
    /CURRENT_TEAM_ID/,
    'server action must derive Team authority from the authorized resource context',
  )
  assert.doesNotMatch(
    action,
    /db\.update\(athleteProfiles\)/,
    'server action must not bypass the team-scoped lifecycle boundary',
  )
})
