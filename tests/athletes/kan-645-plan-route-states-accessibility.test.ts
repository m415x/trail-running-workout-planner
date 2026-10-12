import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')
const loading = readFileSync('app/[locale]/(mobile)/plan/loading.tsx', 'utf8')
const es = JSON.parse(readFileSync('messages/es/athletes/plan.json', 'utf8'))
const en = JSON.parse(readFileSync('messages/en/athletes/plan.json', 'utf8'))

test('KAN-645/I5 Plan route has localized accessible week controls and explicit state labels', () => {
  for (const lang of [es, en]) {
    assert.ok(lang.AthletePlan.previousWeek)
    assert.ok(lang.AthletePlan.nextWeek)
    assert.ok(lang.AthletePlan.plannedOverview)
    assert.ok(lang.AthletePlan.incompleteMetric)
    assert.ok(lang.AthletePlan.unknownMetric)
    assert.ok(lang.AthletePlan.invalidWeek)
    assert.ok(lang.AthletePlan.resolutionConflict)
  }
  assert.match(page, /t\('previousWeek'\)/)
  assert.match(page, /t\('nextWeek'\)/)
  assert.match(page, /t\('resolutionConflict'\)/)
  assert.match(page, /t\('invalidWeek'\)/)
  assert.match(page, /aria-label/)
})

test('KAN-645/I5 loading is distinct, without stale authorized athlete data', () => {
  assert.match(loading, /role=['"]status['"]|aria-busy/)
  assert.doesNotMatch(loading, /getCurrentAthletePlanningPeriod|AthleteSessionCard/)
})

test('KAN-645/I5 Plan overview remains readable without color and mobile clipping', () => {
  assert.match(page, /overview\.weeks\.map/)
  assert.match(page, /min-w-0|break-words|overflow-x-auto/)
  assert.match(page, /sm:grid-cols/)
})
