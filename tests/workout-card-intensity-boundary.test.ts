import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const HOOK_PATH = 'features/workouts/hooks/useWorkoutCard.ts'

test('WorkoutCard hook does not fabricate heart-rate guidance', async () => {
  const source = await readFile(HOOK_PATH, 'utf8')

  assert.doesNotMatch(source, /maxHr\s*=\s*190/)
  assert.doesNotMatch(source, /restHr\s*=\s*50/)
  assert.doesNotMatch(source, /maxHr:\s*190/)
  assert.doesNotMatch(source, /restHr:\s*50/)
})

test('WorkoutCard hook does not derive pace from an HR zone', async () => {
  const source = await readFile(HOOK_PATH, 'utf8')

  assert.doesNotMatch(source, /getZonePaceRangeFromPam/)
  assert.doesNotMatch(source, /athletePamSec/)
})

test('WorkoutCard keeps planned workout pace and time until explicit intensity guidance reaches the boundary', async () => {
  const source = await readFile(HOOK_PATH, 'utf8')

  assert.match(source, /const timeDisplay = workout\.time/)
  assert.match(source, /const paceDisplay = formatPace\(workout\.pace\)/)
  assert.match(source, /const speedDisplay = paceToSpeed\(workout\.pace\)/)
})


test('WorkoutCard presentation requires first-class zone execution guidance', async () => {
  const cardSource = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')
  const hookSource = await readFile(HOOK_PATH, 'utf8')

  assert.match(hookSource, /ExecutionGuidance/)
  assert.match(cardSource, /executionGuidance/)
  assert.match(hookSource, /executionGuidance/)
  assert.match(hookSource, /zoneInfo/)
  assert.match(cardSource, /ZonePill/)
  assert.doesNotMatch(cardSource, /(?:maxHr|maxHR)\s*[:=]\s*190/)
  assert.doesNotMatch(cardSource, /(?:restHr|restHR)\s*[:=]\s*50/)
})


test('mobile workout boundary preserves percentage prescription and athlete running reference', async () => {
  const homeSource = await readFile('features/workouts/HomeTab.tsx', 'utf8')
  const homeHookSource = await readFile('features/workouts/hooks/useHomeTab.ts', 'utf8')
  const pageSource = await readFile('app/[locale]/(mobile)/page.tsx', 'utf8')

  assert.match(homeHookSource, /intensityMethod/)
  assert.match(homeHookSource, /pamPercentage/)
  assert.match(homeSource, /runningReference/)
  assert.match(pageSource, /runningReference/)
})

test('WorkoutCard uses percentage execution guidance pace only when a running reference is available', async () => {
  const cardSource = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')
  const hookSource = await readFile(HOOK_PATH, 'utf8')

  assert.match(hookSource, /workout[.]intensity/)
  assert.match(hookSource, /workout[.]runningReference/)
  assert.match(cardSource, /quality/)
  assert.match(cardSource, /paceLabel/)
})
