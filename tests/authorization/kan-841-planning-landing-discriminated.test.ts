import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const landing = readFileSync('app/[locale]/dashboard/planning/page.tsx', 'utf8')
const es = JSON.parse(readFileSync('messages/es/planning/coach-planning.json', 'utf8')).CoachPlanning.list
const en = JSON.parse(readFileSync('messages/en/planning/coach-planning.json', 'utf8')).CoachPlanning.list

test('KAN-841/T2 Coach Planning landing consumes the authorized discriminated reader, never legacy []', () => {
  assert.match(landing, /getCoachPlanningListResult/)
  assert.doesNotMatch(landing, /getGroupTrainingPlans\s*\(/)
  assert.match(landing, /status\s*===\s*['"]denied['"]|case ['"]denied['"]/)
  assert.match(landing, /status\s*===\s*['"]empty['"]|case ['"]empty['"]/)
  assert.match(landing, /status\s*===\s*['"]ready['"]|case ['"]ready['"]/)
  assert.match(landing, /status\s*===\s*['"]error['"]|case ['"]error['"]/)
})

test('KAN-841/T2 never offers new-strategy CTA to a denied, unselected or invalid Team', () => {
  assert.match(landing, /canCreateStrategy|createAllowed|creationAllowed/)
  assert.match(landing, /\b(canCreateStrategy|createAllowed|creationAllowed)\s*&&/)
  assert.match(landing, /newStrategy/)
})

test('KAN-841/T2 ES/EN explain denied versus authorized empty and H3 operational states', () => {
  for (const [locale, list] of [['es', es], ['en', en]] as const) {
    for (const key of ['deniedTitle', 'deniedDescription', 'emptyTitle', 'emptyDescription',
      'errorTitle', 'errorDescription', 'selectionRequiredTitle',
      'selectionRequiredDescription', 'invalidContextTitle', 'invalidContextDescription']) {
      assert.equal(typeof list[key], 'string', `${locale}: ${key} missing`)
      assert.ok(list[key].trim().length > 0, `${locale}: ${key} empty`)
    }
  }
})
