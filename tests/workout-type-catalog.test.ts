import assert from 'node:assert/strict'
import test from 'node:test'

import { WORKOUT_TYPES, isWorkoutType } from '@/types/training/workout.types'

test('canonical workout type catalog preserves the persisted domain values', () => {
  assert.deepEqual(WORKOUT_TYPES, [
    'Base',
    'Long',
    'Intervals',
    'Trail',
    'Speed',
    'Fartlek',
    'PAM',
    'Hills',
    'Rest',
    'Race',
  ])
})

test('canonical workout type guard accepts only catalog values', () => {
  for (const workoutType of WORKOUT_TYPES) {
    assert.equal(isWorkoutType(workoutType), true)
  }

  assert.equal(isWorkoutType('Tempo'), false)
  assert.equal(isWorkoutType('intervals'), false)
  assert.equal(isWorkoutType(''), false)
  assert.equal(isWorkoutType(null), false)
})
