import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

describe('race registration Next.js action adapter', () => {
  it('is a thin server action composed from the tested registration boundaries', () => {
    assert.match(source, /^'use server'/)
    assert.match(source, /executeRaceRegistrationServerAction/)
    assert.match(source, /runBulkRaceRegistrationAction/)
    assert.match(source, /buildRaceRegistrationActionDependencies/)
    assert.match(source, /revalidatePath/)
  })

  it('uses server-owned team context and real SQLite repositories', () => {
    assert.match(source, /CURRENT_TEAM_ID\s*=\s*['"]team_1['"]/)
    assert.match(source, /getRaceCourse/)
    assert.match(source, /getRaceEdition/)
    assert.match(source, /getRaceEvent/)
    assert.match(source, /findRaceRegistrationInEdition/)
    assert.match(source, /createRaceRegistration/)
    assert.doesNotMatch(source, /formData\.get\(['"]teamId['"]\)/)
  })

  it('exports the form action and delegates FormData to the execution boundary', () => {
    assert.match(source, /export async function registerAthletesForRaceCourse\s*\(\s*formData:\s*FormData/)
    assert.match(source, /executeRaceRegistrationServerAction\(formData,/)
  })
})
