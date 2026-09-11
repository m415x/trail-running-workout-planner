import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { preserveProtectedCompetitionPlanning } from '@/lib/periodization/competition-adjustment-protection'

import type { CompetitionAdjustmentProposal } from '@/types'

function proposal(): CompetitionAdjustmentProposal {
  return {
    competitionId: 'race-a',
    competitionDate: '2026-10-18',
    priority: 'A',
    window: {} as CompetitionAdjustmentProposal['window'],
    source: {} as CompetitionAdjustmentProposal['source'],
    recovery: {} as CompetitionAdjustmentProposal['recovery'],
    affectedMicrocycles: [
      {
        microcycleId: 'week-1',
        weekNumber: 1,
        current: {
          type: 'development',
          targetVolumeKm: 60,
          targetElevationGainM: 2_000,
        },
        phases: ['pre'],
        proposed: {
          type: 'tapering',
          targetVolumeKm: 42,
          targetElevationGainM: 1_300,
          allowIntenseSessions: null,
        },
        reasonCodes: ['taper_volume_ceiling', 'taper_elevation_ceiling'],
      },
    ],
    conflicts: [],
    requiresCoachReview: false,
    rationale: {
      taperDurationDays: 7,
      recoveryDurationDays: 7,
      demandBand: 'moderate',
      competitionWeekTraining: { volumeKm: 20, elevationGainM: 400 },
    },
  }
}

describe('competition adjustment protection', () => {
  it('preserves manual volume and elevation values and surfaces visible conflicts', () => {
    const protectedProposal = preserveProtectedCompetitionPlanning({
      proposal: proposal(),
      protectedState: [{
        microcycleId: 'week-1',
        targetVolumeSource: 'manual',
        targetElevationSource: 'manual',
      }],
    })
    const preview = protectedProposal.affectedMicrocycles[0]

    assert.equal(preview.proposed.targetVolumeKm, 60)
    assert.equal(preview.proposed.targetElevationGainM, 2_000)
    assert.deepEqual(preview.preservedFields, ['target_volume_km', 'target_elevation_gain_m'])
    assert.equal(protectedProposal.protectionConflicts.length, 2)
    assert.equal(protectedProposal.requiresCoachReview, true)
  })

  it('keeps generated values adjustable', () => {
    const protectedProposal = preserveProtectedCompetitionPlanning({
      proposal: proposal(),
      protectedState: [{
        microcycleId: 'week-1',
        targetVolumeSource: 'generated',
        targetElevationSource: 'generated',
      }],
    })
    const preview = protectedProposal.affectedMicrocycles[0]

    assert.equal(preview.proposed.targetVolumeKm, 42)
    assert.equal(preview.proposed.targetElevationGainM, 1_300)
    assert.equal(protectedProposal.protectionConflicts.length, 0)
  })

  it('preserves a protected microcycle type instead of silently converting it to tapering', () => {
    const protectedProposal = preserveProtectedCompetitionPlanning({
      proposal: proposal(),
      protectedState: [{ microcycleId: 'week-1', protectMicrocycle: true }],
    })

    assert.equal(protectedProposal.affectedMicrocycles[0].proposed.type, 'development')
    assert.ok(protectedProposal.affectedMicrocycles[0].preservedFields.includes('microcycle_type'))
  })

  it('reports protected objectives and sessions without pretending to rewrite them', () => {
    const protectedProposal = preserveProtectedCompetitionPlanning({
      proposal: proposal(),
      protectedState: [{
        microcycleId: 'week-1',
        protectObjective: true,
        protectedSessionIds: ['session-1', 'session-2'],
      }],
    })

    assert.ok(protectedProposal.affectedMicrocycles[0].preservedFields.includes('objective'))
    assert.ok(protectedProposal.affectedMicrocycles[0].preservedFields.includes('session'))
    assert.deepEqual(
      protectedProposal.protectionConflicts.find((item) => item.field === 'session')?.relatedEntityIds,
      ['session-1', 'session-2'],
    )
    assert.equal(protectedProposal.requiresCoachReview, true)
  })
})
