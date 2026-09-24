import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'

describe('athlete variable-terrain duration boundary', () => {
  it('keeps planned duration visible while suppressing derived pace and speed for Trail/Hills', () => {
    const card = readFileSync('features/workouts/components/WorkoutCard.tsx', 'utf8')

    assert.match(card, /stat\.kind !== 'pace'/)
    assert.match(card, /stat\.kind !== 'speed'/)
    assert.doesNotMatch(card, /stat\.kind !== 'duration'/)
  })

  it('does not label planned group duration as an athlete estimated time', () => {
    const hook = readFileSync('features/workouts/hooks/useWorkoutCard.ts', 'utf8')

    assert.doesNotMatch(hook, /label: t\('card\.estimatedTime'\)/)
  })
})
