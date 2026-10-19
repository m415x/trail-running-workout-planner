import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actions = readFileSync(path.join(process.cwd(), 'app/actions/competition-calendar-actions.ts'), 'utf8')
const catalog = readFileSync(path.join(process.cwd(), 'lib/race-catalog/catalog-repository.ts'), 'utf8')

test('KAN-829 T3 RED: catalog creation uses the same transaction for Entry and course link', () => {
  const start = actions.indexOf('export async function createCompetitionFromCatalogAction(')
  assert.ok(start >= 0)
  const body = actions.slice(start)
  assert.match(body, /db\.transaction\(\(tx\)\s*=>/)
  assert.match(body, /createCompetition\(\{[\s\S]*?database:\s*tx/)
  assert.match(body, /linkCompetitionEntryToRaceCourse\(result\.value\.id,\s*context\.course\.id,\s*tx(?: as typeof db)?\)/)
})

test('KAN-829 T3 RED: linking a catalog course accepts the transaction database', () => {
  const start = catalog.indexOf('export function linkCompetitionEntryToRaceCourse(')
  assert.ok(start >= 0)
  const body = catalog.slice(start, catalog.indexOf('\n}', start) + 2)
  assert.match(body, /database/)
  assert.doesNotMatch(body, /\n  db\.insert\(/)
})
