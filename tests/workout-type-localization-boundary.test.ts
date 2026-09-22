import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const constantsSource = fs.readFileSync(path.join(process.cwd(), 'lib/constants.ts'), 'utf8')
const helpersSource = fs.readFileSync(path.join(process.cwd(), 'lib/workout-helpers.ts'), 'utf8')

test('workout metadata does not own localized product copy', () => {
  const workoutConfigSource = constantsSource.slice(
    constantsSource.indexOf('export interface WorkoutTypeConfig'),
    constantsSource.indexOf('export interface HrZoneStyles'),
  )

  assert.doesNotMatch(workoutConfigSource, /label\s*:/)
  assert.doesNotMatch(workoutConfigSource, /description\s*:/)
})

test('workout helpers do not own localized fallback copy', () => {
  assert.doesNotMatch(helpersSource, /Entrenamiento/)
})
