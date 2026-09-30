import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const review = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')
const es = JSON.parse(read('messages/es/planning/sessions.json'))
const en = JSON.parse(read('messages/en/planning/sessions.json'))

test('intensity and assignment render as sibling responsive cards', () => {
  assert.match(review, /grid[^'"]*gap-[^'"]*(?:md|lg):grid-cols-2/)
  assert.match(review, /rounded-lg border p-4/)
  assert.match(review, /adjustments\.doseIntensityCard|adjustments\.intensity/)
  assert.match(review, /adjustments\.assignmentTitle/)
})

test('reference percentage dependent field avoids repeating the method label', () => {
  assert.match(review, /adjustments\.referencePercentageValue/)
  assert.match(review, /adjustments\.selectReferencePercentage/)
  assert.equal(es.Sessions.adjustments.referencePercentageValue, 'Valor')
  assert.equal(en.Sessions.adjustments.referencePercentageValue, 'Value')
  assert.match(es.Sessions.adjustments.selectReferencePercentage, /Seleccionar porcentaje/)
  assert.match(en.Sessions.adjustments.selectReferencePercentage, /Select percentage/)
})
