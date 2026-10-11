import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 classifies mutation exports missed by the original action-name heuristic', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  for (const [path, names] of [
    ['app/actions/team-context-actions.ts', ['selectActiveTeamAction']],
    ['app/actions/session-generation-actions.ts', ['persistGeneratedSessions']],
    ['app/actions/auth-actions.ts', ['loginAction', 'logoutAction', 'completePasswordRecoveryAction']],
  ] as const) {
    const source = readFileSync(path, 'utf8')
    for (const name of names) {
      assert.ok(source.includes('export async function ' + name + '('), 'Source action disappeared: ' + name)
      assert.ok(inventory.includes(name), 'Missing action classification: ' + path + ' :: ' + name)
    }
  }
})
