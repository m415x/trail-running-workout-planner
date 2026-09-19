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
  assert.equal(result.quality?.source.evaluationId, 'eval_1000m')
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
