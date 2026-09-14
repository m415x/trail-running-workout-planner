import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateManualRealizedTrainingCapture } from '@/lib/realized-training/capture-contract'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

const unknown = { state: 'unknown' } as const

function input(overrides: Partial<ManualRealizedTrainingCaptureInput> = {}): ManualRealizedTrainingCaptureInput {
  return {
    athleteId: 'athlete-1',
    sessionId: null,
    workoutId: null,
    date: '2026-09-13',
    status: 'completed',
    metrics: {
      distanceKm: unknown,
      durationMin: unknown,
      elevationGainM: unknown,
      avgHrBpm: unknown,
      rpe: unknown,
    },
    feeling: null,
    athleteNotes: null,
    ...overrides,
  }
}

describe('manual realized training capture contract', () => {
  it('preserva unknown sin convertirlo en cero', () => {
    const value = input()
    const result = validateManualRealizedTrainingCapture(value)

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.value.metrics.distanceKm, { state: 'unknown' })
    assert.deepEqual(result.value.metrics.elevationGainM, { state: 'unknown' })
  })

  it('acepta cero explicito como metrica conocida', () => {
    const value = input({
      metrics: {
        distanceKm: { state: 'known', value: 0 },
        durationMin: { state: 'known', value: 45 },
        elevationGainM: { state: 'known', value: 0 },
        avgHrBpm: unknown,
        rpe: { state: 'known', value: 0 },
      },
    })

    const result = validateManualRealizedTrainingCapture(value)
    assert.equal(result.ok, true)
  })

  it('permite entrenamiento libre sin sessionId ni workoutId', () => {
    const result = validateManualRealizedTrainingCapture(input({ sessionId: null, workoutId: null }))
    assert.equal(result.ok, true)
  })

  it('rechaza valores negativos o no finitos', () => {
    const value = input({
      metrics: {
        distanceKm: { state: 'known', value: -1 },
        durationMin: { state: 'known', value: Number.NaN },
        elevationGainM: unknown,
        avgHrBpm: unknown,
        rpe: unknown,
      },
    })

    const result = validateManualRealizedTrainingCapture(value)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.ok(result.issues.some((issue) => issue.field === 'distanceKm' && issue.code === 'invalid_number'))
    assert.ok(result.issues.some((issue) => issue.field === 'durationMin' && issue.code === 'invalid_number'))
  })

  it('limita RPE conocido al rango 0-10', () => {
    const value = input({
      metrics: {
        distanceKm: unknown,
        durationMin: unknown,
        elevationGainM: unknown,
        avgHrBpm: unknown,
        rpe: { state: 'known', value: 11 },
      },
    })

    const result = validateManualRealizedTrainingCapture(value)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.ok(result.issues.some((issue) => issue.field === 'rpe' && issue.code === 'out_of_range'))
  })

  it('rechaza fechas imposibles sin reinterpretarlas', () => {
    const result = validateManualRealizedTrainingCapture(input({ date: '2026-02-30' }))
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.ok(result.issues.some((issue) => issue.field === 'date' && issue.code === 'invalid_date'))
  })
})
