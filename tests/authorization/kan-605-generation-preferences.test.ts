import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/session-generation-preferences-actions.ts', 'utf8')

function action(name: string) {
  const start = source.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1)
  const next = source.indexOf('export async function ', start + 1)
  return source.slice(start, next < 0 ? undefined : next)
}

describe('KAN-677 H4B per-plan generation preferences RED', () => {
  it('resolves persisted plan, Sporting Group and active Team through authenticated H2/H4A/H3', () => {
    assert.doesNotMatch(source, /CURRENT_TEAM_ID/)
    assert.match(source, /requireAuthenticatedEptAction/)
    assert.match(source, /createActiveTeamNextServerContext/)
    assert.match(source, /planning\.manage/)
    assert.match(source, /sportingGroupId/)
    assert.match(source, /groupTrainingPlans\.groupId/)
  })

  it('refuses preferences reads when plan ownership or planning.manage is denied', () => {
    const read = action('getSessionGenerationPreferencesForPlan')
    assert.match(read, /await .*authorize|await .*Planning/)
    assert.match(read, /if\s*\(!.*\)\s*return null/)
  })

  it('requires plan authorization before preferences mutation transaction', () => {
    const write = action('updateSessionGenerationPreferences')
    assert.match(write, /await .*authorize|await .*Planning/)
    const guard = write.search(/if\s*\(!.*\)/)
    const transaction = write.indexOf('db.transaction(')
    assert.ok(guard !== -1 && transaction > guard)
  })

  it('preserves weekly pattern validation and create-or-update semantics', () => {
    const write = action('updateSessionGenerationPreferences')
    assert.match(write, /parseWeeklySessionFrequency/)
    assert.match(write, /buildWeeklyTrainingPattern/)
    assert.match(write, /serializeSessionGenerationPreferences/)
    assert.match(write, /tx\.update\(sessionGenerationPreferences\)/)
    assert.match(write, /tx\.insert\(sessionGenerationPreferences\)/)
  })
})
