import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 classifies repository writer contracts discovered beyond app/actions', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  const repositories = [
    'lib/competitions/race-registration-persistence.ts',
    'lib/planning-cohorts/variant-persistence.ts',
    'lib/realized-training/realized-training-correction-repository.ts',
    'lib/session-generation/generation-explanation-persistence.ts',
    'lib/workout-templates/workout-template-persistence.ts',
  ]
  for (const file of repositories) {
    readFileSync(file, 'utf8')
    assert.ok(inventory.includes(file), 'Missing internal repository scope decision: ' + file)
  }
})
