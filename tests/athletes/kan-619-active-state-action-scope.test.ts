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

  const actionMatch = source.match(
    /export async function setAthleteActiveState[\s\S]*?\n}\n/,
  )
  assert.ok(actionMatch, 'setAthleteActiveState action must exist')

  const action = actionMatch[0]

  assert.match(
    action,
    /setAthleteProfileActiveState\(db,\s*\{[\s\S]*?teamId:\s*CURRENT_TEAM_ID[\s\S]*?athleteId[\s\S]*?isActive/,
  )
  assert.doesNotMatch(
    action,
    /db\.update\(athleteProfiles\)/,
    'server action must not bypass the team-scoped lifecycle boundary',
  )
})
