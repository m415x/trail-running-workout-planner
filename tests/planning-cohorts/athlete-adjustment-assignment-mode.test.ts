import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const review = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')
const actions = read('app/actions/athlete-session-adjustment-actions.ts')

test('Coach chooses exactly one assignment override mode', () => {
  assert.match(review, /name=['"]assignmentMode['"]/)
  assert.match(review, /value=['"]inherit['"]/)
  assert.match(review, /value=['"]rescheduled['"]/)
  assert.match(review, /value=['"]stimulus_override['"]/)
  assert.match(review, /value=['"]omitted['"]/)
  assert.doesNotMatch(review, /name=['"]omitted['"][^>]*type=['"]checkbox['"]/)
})

test('server parses assignment from explicit mode instead of precedence between competing fields', () => {
  assert.match(actions, /formData\.get\(['"]assignmentMode['"]\)/)
  assert.doesNotMatch(actions, /if \(formData\.get\(['"]omitted['"]\) === ['"]on['"]\)/)
  assert.match(actions, /assignmentMode === ['"]stimulus_override['"]/)
  assert.match(actions, /assignmentMode === ['"]rescheduled['"]/)
  assert.match(actions, /assignmentMode === ['"]omitted['"]/)
})
