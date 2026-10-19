import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actions = readFileSync(path.join(process.cwd(), 'app/actions/competition-calendar-actions.ts'), 'utf8')
const guardPath = path.join(process.cwd(), 'lib/periodization/authorized-competition-calendar-mutation.ts')

test('KAN-830 T4 RED: all five Server Action writers delegate through an injectable authorization-before-write seam', () => {
  const names = [
    'createCompetitionAction',
    'updateCompetitionAction',
    'rescheduleCompetitionAction',
    'changeCompetitionStatusAction',
    'createCompetitionFromCatalogAction',
  ]
  for (const name of names) {
    const start = actions.indexOf(`export async function ${name}(`)
    assert.ok(start >= 0, `missing ${name}`)
    const body = actions.slice(start, actions.indexOf('\nexport async function ', start + 1) === -1
      ? actions.length
      : actions.indexOf('\nexport async function ', start + 1))
    assert.match(body, /runAuthorizedCompetitionMutation\(/, `${name} must gate its delegated write`)
  }
  assert.match(readFileSync(guardPath, 'utf8'), /export async function runAuthorizedCompetitionMutation\(/)
})
