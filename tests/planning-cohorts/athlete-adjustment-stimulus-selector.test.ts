import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const detail = read('app/[locale]/dashboard/sessions/[sessionId]/page.tsx')
const review = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')
const actions = read('app/actions/athlete-session-adjustment-actions.ts')

test('Coach selects stimulus workout templates by human label instead of entering UUIDs', () => {
  assert.match(detail, /getSessionFormOptions|workoutOptions|workouts/)
  assert.match(review, /workouts|workoutOptions/)
  assert.doesNotMatch(review, /name=['"]stimulus['"][\s\S]{0,160}<Input/)
  assert.match(review, /<select[\s\S]{0,240}name=['"]stimulus['"]/)
  assert.match(review, /workout\.title/)
  assert.match(review, /workoutTypeT\(`types\.\$\{workout\.type\}`\)/)
})

test('server validates a selected stimulus workout belongs to the team and derives its type', () => {
  assert.match(actions, /workouts/)
  assert.match(actions, /stimulusWorkout/)
  assert.match(actions, /teamId/)
  assert.match(actions, /stimulusWorkout\.type/)
})
