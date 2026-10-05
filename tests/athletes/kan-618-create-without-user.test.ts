import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

function createAthleteBody(): string {
  const action = source('app/actions/athlete-actions.ts')
  const start = action.indexOf('export async function createAthlete')
  const end = action.indexOf('export async function updateAthlete')

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  return action.slice(start, end)
}

test('KAN-618 create action delegates AthleteProfile administration without creating an EPT User', () => {
  const body = createAthleteBody()

  assert.doesNotMatch(body, /tx\.insert\(users\)/)
  assert.doesNotMatch(body, /existingUser/)
  assert.match(body, /createAthleteAdministration\(db,/)
  assert.match(body, /firstName:\s*data\.firstName/)
  assert.match(body, /lastName:\s*data\.lastName/)
  assert.match(body, /contactEmail:\s*data\.email/)
})

test('KAN-618 creation boundary owns one transaction and unlinked AthleteProfile persistence', () => {
  const boundary = source('lib/athletes/create-athlete-administration.ts')

  assert.match(boundary, /database\.transaction\(\(tx\) => \{/)
  assert.match(boundary, /tx\.insert\(athleteProfiles\)/)
  assert.match(boundary, /userId:\s*null/)
  assert.match(boundary, /firstName:\s*input\.firstName/)
  assert.match(boundary, /lastName:\s*input\.lastName/)
  assert.match(boundary, /contactEmail:\s*input\.contactEmail/)
  assert.match(boundary, /initializeBilling\(tx\)/)
})

test('KAN-618 action composes billing initialization through the transaction callback', () => {
  const body = createAthleteBody()

  assert.match(body, /createMembershipServerActionRuntime\(\{[\s\S]*db:\s*tx/)
  assert.match(body, /initializeNewAthleteBillingInTransaction/)
})
