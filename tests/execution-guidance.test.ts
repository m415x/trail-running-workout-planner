import assert from 'node:assert/strict'
import test from 'node:test'

import {
  INTENSITY_GUIDANCE_POLICY,
  resolveExecutionGuidance,
} from '@/lib/physiology/execution-guidance'
import type { TrainingIntensity } from '@/types/training/intensity.types'

test('keeps quality percentage prescription distinct from zone guidance', () => {
  const intensity: TrainingIntensity = {
    method: 'pam_percentage',
    pamPercentage: 90,
  }

  const result = resolveExecutionGuidance({
    intensity,
    runningReference: {
      status: 'available',
      source: {
        evaluationId: 'eval_1000m',
        protocol: '1000m_track',
        performedAt: '2026-09-17',
        distanceM: 1000,
        elapsedTimeSec: 259,
      },
      derived: {
        paceSecPerKm: 259,
        paceLabel: '4:19/km',
        averageSpeedKmh: 13.9,
      },
    },
  })

  assert.equal(result.policyVersion, INTENSITY_GUIDANCE_POLICY.version)
  assert.equal(result.prescription.method, 'pam_percentage')
  assert.equal(result.prescription.pamPercentage, 90)
  assert.equal(result.quality?.status, 'available')
  if (result.quality?.status !== 'available') return
  assert.equal(result.quality.source.evaluationId, 'eval_1000m')
  assert.equal(result.zone, null)
})

test('keeps Z1-Z5 prescription independent from the 1000 m running reference', () => {
  const intensity: TrainingIntensity = {
    method: 'hr_zone',
    zone: 'Z2',
  }

  const result = resolveExecutionGuidance({
    intensity,
    runningReference: {
      status: 'available',
      source: {
        evaluationId: 'eval_1000m',
        protocol: '1000m_track',
        performedAt: '2026-09-17',
        distanceM: 1000,
        elapsedTimeSec: 259,
      },
      derived: {
        paceSecPerKm: 259,
        paceLabel: '4:19/km',
        averageSpeedKmh: 13.9,
      },
    },
  })

  assert.equal(result.policyVersion, INTENSITY_GUIDANCE_POLICY.version)
  assert.equal(result.prescription.method, 'hr_zone')
  assert.equal(result.prescription.zone, 'Z2')
  assert.equal(result.quality, null)
  assert.equal(result.zone?.zone, 'Z2')
})

test('does not synthesize quality pace when the running reference is unknown', () => {
  const result = resolveExecutionGuidance({
    intensity: {
      method: 'pam_percentage',
      pamPercentage: 110,
    },
    runningReference: { status: 'unknown' },
  })

  assert.equal(result.quality?.status, 'unknown')
})


test('derives orientative quality pace and speed from the explicit percentage', () => {
  const result = resolveExecutionGuidance({
    intensity: {
      method: 'pam_percentage',
      pamPercentage: 90,
    },
    runningReference: {
      status: 'available',
      source: {
        evaluationId: 'eval_1000m',
        protocol: '1000m_track',
        performedAt: '2026-09-17',
        distanceM: 1000,
        elapsedTimeSec: 259,
      },
      derived: {
        paceSecPerKm: 259,
        paceLabel: '4:19/km',
        averageSpeedKmh: 13.9,
      },
    },
  })

  assert.equal(result.quality?.status, 'available')
  if (result.quality?.status !== 'available') return

  assert.equal(result.quality.intensityPercentage, 90)
  assert.equal(result.quality.paceSecPerKm, 288)
  assert.equal(result.quality.paceLabel, '4:48/km')
  assert.equal(result.quality.averageSpeedKmh, 12.5)
})

test('supports coach quality percentages above 100 without treating them as zones', () => {
  const result = resolveExecutionGuidance({
    intensity: {
      method: 'pam_percentage',
      pamPercentage: 120,
    },
    runningReference: {
      status: 'available',
      source: {
        evaluationId: 'eval_1000m',
        protocol: '1000m_track',
        performedAt: '2026-09-17',
        distanceM: 1000,
        elapsedTimeSec: 259,
      },
      derived: {
        paceSecPerKm: 259,
        paceLabel: '4:19/km',
        averageSpeedKmh: 13.9,
      },
    },
  })

  assert.equal(result.zone, null)
  assert.equal(result.quality?.status, 'available')
  if (result.quality?.status !== 'available') return

  assert.equal(result.quality.paceSecPerKm, 216)
  assert.equal(result.quality.paceLabel, '3:36/km')
  assert.equal(result.quality.averageSpeedKmh, 16.7)
})


test('provides first-class RPE and talk-test guidance for every Z1-Z5 prescription', () => {
  const expectations = {
    Z1: { rpe: { min: 1, max: 2 }, talkTest: 'comfortable_conversation' },
    Z2: { rpe: { min: 3, max: 4 }, talkTest: 'full_conversation' },
    Z3: { rpe: { min: 5, max: 6 }, talkTest: 'short_phrases' },
    Z4: { rpe: { min: 7, max: 8 }, talkTest: 'few_words' },
    Z5: { rpe: { min: 9, max: 10 }, talkTest: 'no_conversation' },
  } as const

  for (const [zone, expected] of Object.entries(expectations)) {
    const result = resolveExecutionGuidance({
      intensity: {
        method: 'hr_zone',
        zone: zone as keyof typeof expectations,
      },
      runningReference: { status: 'unknown' },
    })

    assert.equal(result.quality, null)
    assert.deepEqual(result.zone, {
      zone,
      rpe: expected.rpe,
      talkTest: expected.talkTest,
      terrainPriority: 'effort_over_pace',
    })
  }
})

test('keeps Z2 executable without a running reference or heart-rate sensor', () => {
  const result = resolveExecutionGuidance({
    intensity: {
      method: 'hr_zone',
      zone: 'Z2',
    },
    runningReference: { status: 'unknown' },
  })

  assert.deepEqual(result.zone, {
    zone: 'Z2',
    rpe: { min: 3, max: 4 },
    talkTest: 'full_conversation',
    terrainPriority: 'effort_over_pace',
  })
})
