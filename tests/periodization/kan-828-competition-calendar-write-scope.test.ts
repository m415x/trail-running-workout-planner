import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repository = readFileSync(
  path.join(process.cwd(), 'lib/periodization/competition-repository.ts'),
  'utf8',
)

test('KAN-828 T2: each persisted Entry UPDATE is scoped to the authorized owning Plan', () => {
  const methods = [
    ['updateCompetitionRecord', 'rescheduleCompetitionRecord'],
    ['rescheduleCompetitionRecord', 'updateCompetitionStatusRecord'],
    ['updateCompetitionStatusRecord', ''],
  ] as const

  for (const [method, next] of methods) {
    const start = repository.indexOf(`export function ${method}(`)
    const end = next ? repository.indexOf(`export function ${next}(`, start + 1) : repository.length
    assert.ok(start >= 0 && end > start, `cannot locate ${method}`)
    const implementation = repository.slice(start, end)
    assert.match(implementation, /eq\(competitionEntries\.groupTrainingPlanId,/, `${method}: SQL UPDATE must condition on ownership`)
  }
})
