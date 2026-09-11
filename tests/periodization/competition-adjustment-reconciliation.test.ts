import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { reconcileReviewedCompetitionAdjustment } from '@/lib/periodization/competition-adjustment-reconciliation'
import type { ReviewedCompetitionAdjustmentProposal } from '@/types'

function reviewedProposal(): ReviewedCompetitionAdjustmentProposal {
  return {
    competitionId: 'race-a',
    competitionDate: '2026-10-18',
    priority: 'A',
    window: {} as ReviewedCompetitionAdjustmentProposal['window'],
    source: {} as ReviewedCompetitionAdjustmentProposal['source'],
    recovery: {} as ReviewedCompetitionAdjustmentProposal['recovery'],
    affectedMicrocycles: [{
      microcycleId: 'week-1',
      weekNumber: 1,
      phases: ['pre'],
      current: { type: 'development', targetVolumeKm: 60, targetElevationGainM: 2_000 },
      reviewed: {
        type: 'tapering',
        targetVolumeKm: 45,
        targetElevationGainM: 1_500,
        allowIntenseSessions: true,
      },
      reasonCodes: ['taper_volume_ceiling', 'taper_elevation_ceiling'],
      preservedFields: [],
      valueSources: {
        type: 'generated',
        targetVolumeKm: 'coach',
        targetElevationGainM: 'generated',
        allowIntenseSessions: 'generated',
      },
    }],
    conflicts: [],
    protectionConflicts: [],
    requiresCoachReview: false,
    rationale: {
      taperDurationDays: 7,
      recoveryDurationDays: 7,
      demandBand: 'moderate',
      competitionWeekTraining: { volumeKm: 20, elevationGainM: 400 },
    },
    decision: 'adjusted',
    reviewedAtBoundary: true,
  }
}

describe('competition adjustment reconciliation', () => {
  it('creates patches only for microcycles in the reviewed competitive window', () => {
    const result = reconcileReviewedCompetitionAdjustment({
      groupTrainingPlanId: 'plan-1',
      reviewedProposal: reviewedProposal(),
      changedByUserId: 'coach-1',
    })

    assert.deepEqual(result.patches.map((patch) => patch.microcycleId), ['week-1'])
    assert.equal(result.patches[0].targetVolumeKm, 45)
  })

  it('records generated and coach provenance for changed values', () => {
    const result = reconcileReviewedCompetitionAdjustment({
      groupTrainingPlanId: 'plan-1',
      reviewedProposal: reviewedProposal(),
      changedByUserId: 'coach-1',
    })

    const volume = result.auditRecords.find((record) => record.field === 'target_volume_km')
    const type = result.auditRecords.find((record) => record.field === 'type')

    assert.equal(volume?.source, 'coach')
    assert.equal(volume?.changedByUserId, 'coach-1')
    assert.equal(type?.source, 'generated')
  })

  it('does not create audit records for unchanged values', () => {
    const proposal = reviewedProposal()
    const unchanged: ReviewedCompetitionAdjustmentProposal = {
      ...proposal,
      affectedMicrocycles: proposal.affectedMicrocycles.map((item) => ({
        ...item,
        reviewed: {
          ...item.reviewed,
          type: item.current.type,
          targetVolumeKm: item.current.targetVolumeKm,
          targetElevationGainM: item.current.targetElevationGainM,
        },
      })),
    }

    const result = reconcileReviewedCompetitionAdjustment({
      groupTrainingPlanId: 'plan-1',
      reviewedProposal: unchanged,
    })

    assert.equal(result.auditRecords.length, 0)
  })
})
