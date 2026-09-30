import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const actions = read('app/actions/athlete-session-adjustment-actions.ts')
const review = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')
const es = JSON.parse(read('messages/es/planning/sessions.json'))
const en = JSON.parse(read('messages/en/planning/sessions.json'))

test('Coach review exposes the current adjustment audit reason', () => {
  assert.match(actions, /currentReason/)
  assert.match(review, /item\.currentReason/)
  assert.match(review, /adjustments\.currentReason/)
  assert.match(es.Sessions.adjustments.currentReason, /Motivo/)
  assert.match(en.Sessions.adjustments.currentReason, /Reason/)
})
