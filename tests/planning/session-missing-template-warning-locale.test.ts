import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const templateSelection = read('lib/session-generation/workout-template-selection.ts')
const preview = read('features/planning/components/SessionGenerationPreview.tsx')
const es = JSON.parse(read('messages/es/planning/coach-planning.json')).CoachPlanning
const en = JSON.parse(read('messages/en/planning/coach-planning.json')).CoachPlanning

test('KAN-577 missing-template warning is parsed for presentation instead of leaking period and role codes', () => {
  const parser = read('lib/session-generation/missing-template-warning.ts')
  assert.match(parser, /export function parseMissingTemplateWarning/)
  assert.match(parser, /general_preparatory/)
  assert.match(parser, /specific_preparatory/)
  assert.match(parser, /role/)
  assert.match(parser, /microcycleType/)
  assert.match(templateSelection, /No hay una plantilla activa compatible con el rol/)
  assert.ok(preview.includes('parseMissingTemplateWarning'))
  assert.ok(preview.includes('sessionPreview.missingTemplate'))
  assert.ok(preview.includes('sessionPreview.periods.'))
  assert.ok(preview.includes('roles.'))
  assert.ok(preview.includes('microcycleType.types.'))
})

test('KAN-577 generation warnings use one localized presentation in event and summary without changing raw payload', () => {
  assert.ok(preview.includes('formatWarning(warning)'))
  assert.ok(preview.includes('warnings.map((warning)'))
  assert.ok(preview.includes('event.warnings.map((warning)'))
  assert.ok(preview.includes('value={JSON.stringify(proposal)}'))
  for (const t of [es, en]) {
    assert.ok(t.sessionPreview.missingTemplate)
    for (const period of ['general_preparatory','specific_preparatory','competitive','transition']) {
      assert.ok(t.sessionPreview.periods?.[period])
    }
    for (const role of ['base','mountain','long','quality','recovery','competition']) {
      assert.ok(t.roles[role])
    }
    for (const type of ['base','development','shock','deload','tapering','race']) {
      assert.ok(t.microcycleType.types[type])
    }
  }
})
