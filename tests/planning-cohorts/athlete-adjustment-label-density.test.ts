import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const review = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')
const es = JSON.parse(read('messages/es/planning/sessions.json'))
const en = JSON.parse(read('messages/en/planning/sessions.json'))

test('compact adjustment cards avoid repeated labels', () => {
  assert.match(review, /adjustments\.intensityMethod/)
  assert.match(review, /adjustments\.rescheduleDate/)
  assert.equal(es.Sessions.adjustments.intensityMethod, 'Método')
  assert.equal(en.Sessions.adjustments.intensityMethod, 'Method')
  assert.equal(es.Sessions.adjustments.rescheduleDate, 'Fecha')
  assert.equal(en.Sessions.adjustments.rescheduleDate, 'Date')
})
