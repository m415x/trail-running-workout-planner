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

  it('labels the athlete-facing value explicitly as planned group duration in ES/EN', () => {
    const hook = readFileSync('features/workouts/hooks/useWorkoutCard.ts', 'utf8')
    const es = JSON.parse(readFileSync('messages/es/realized-training/workouts.json', 'utf8'))
    const en = JSON.parse(readFileSync('messages/en/realized-training/workouts.json', 'utf8'))

    assert.doesNotMatch(hook, /label: t\('card\.estimatedTime'\)/)
    assert.equal(es.Workouts.card.plannedDuration, 'Duración grupal planificada')
    assert.equal(en.Workouts.card.plannedDuration, 'Planned group duration')
  })
})
