import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const review = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')

test('individual assignment renders only fields relevant to the selected mode', () => {
  assert.match(review, /useState/)
  assert.match(review, /assignmentMode/)
  assert.match(review, /assignmentMode === ['"]rescheduled['"]/)
  assert.match(review, /assignmentMode === ['"]stimulus_override['"]/)
  assert.doesNotMatch(review, /assignmentMode === ['"]inherit['"][\s\S]{0,200}<LabeledInput/)
  assert.doesNotMatch(review, /assignmentMode === ['"]omitted['"][\s\S]{0,200}<LabeledInput/)
})

test('intensity renders only the controls relevant to the selected method', () => {
  assert.match(review, /intensityMethod/)
  assert.match(review, /intensityMethod === ['"]hr_zone['"]/)
  assert.match(review, /intensityMethod === ['"]reference_percentage['"]/)
  assert.match(review, /SESSION_REFERENCE_PERCENTAGES/)
  assert.match(review, /name=['"]referencePercentage['"]/)
  assert.match(review, /<select[\s\S]{0,220}name=['"]referencePercentage['"]/)
})
