import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/actions/athlete-actions.ts'),
  'utf8',
)

function createAthleteBody(): string {
  const start = source.indexOf('export async function createAthlete')
  const end = source.indexOf('export async function updateAthlete')

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  return source.slice(start, end)
}

test('KAN-618 creates AthleteProfile administration without creating an EPT User', () => {
  const body = createAthleteBody()

  assert.doesNotMatch(body, /tx\.insert\(users\)/)
  assert.doesNotMatch(body, /existingUser/)
  assert.match(body, /tx\.insert\(athleteProfiles\)/)
  assert.match(body, /firstName:\s*data\.firstName/)
  assert.match(body, /lastName:\s*data\.lastName/)
  assert.match(body, /contactEmail:\s*data\.email/)
  assert.match(body, /userId:\s*null/)
})

test('KAN-618 keeps athlete creation and billing initialization in one transaction', () => {
  const body = createAthleteBody()

  assert.match(body, /db\.transaction\(\(tx\) => \{/)
  assert.match(body, /createMembershipServerActionRuntime\(\{[\s\S]*db:\s*tx/)
  assert.match(body, /initializeNewAthleteBillingInTransaction/)
})
