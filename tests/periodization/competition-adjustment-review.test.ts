import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { reviewCompetitionAdjustmentProposal } from '@/lib/periodization/competition-adjustment-review'

import type { ProtectedCompetitionAdjustmentProposal } from '@/types'

function proposal(preservedFields: ProtectedCompetitionAdjustmentProposal['affectedMicrocycles'][number]['preservedFields'] = []): ProtectedCompetitionAdjustmentProposal {
  return {
    competitionId: 'race-a',
    competitionDate: '2026-10-18',
    priority: 'A',
    window: {} as ProtectedCompetitionAdjustmentProposal['window'],
    source: {} as ProtectedCompetitionAdjustmentProposal['source'],
    recovery: {} as ProtectedCompetitionAdjustmentProposal['recovery'],
    affectedMicrocycles: [{
      microcycleId: 'week-1',
      weekNumber: 1,
      current: { type: 'development', targetVolumeKm: 60, targetElevationGainM: 2_000 },
      phases: ['pre'],
      proposed: {
        type: 'tapering',
        targetVolumeKm: 42,
        targetElevationGainM: 1_300,
        allowIntenseSessions: true,
      },
      reasonCodes: ['taper_volume_ceiling', 'taper_elevation_ceiling'],
      preservedFields,
    }],
    conflicts: [],
    protectionConflicts: [],
    requiresCoachReview: preservedFields.length > 0,
    rationale: {
      taperDurationDays: 7,
      recoveryDurationDays: 7,
      demandBand: 'moderate',
      competitionWeekTraining: { volumeKm: 20, elevationGainM: 400 },
    },
  }
}

describe('competition adjustment coach review', () => {
  it('accepts an unchanged proposal and keeps generated provenance', () => {
    const reviewed = reviewCompetitionAdjustmentProposal({
      proposal: proposal(),
      decision: 'accepted',
    })

    assert.equal(reviewed.decision, 'accepted')
    assert.equal(reviewed.requiresCoachReview, false)
    assert.equal(reviewed.reviewedAtBoundary, true)
    assert.equal(reviewed.affectedMicrocycles[0].reviewed.targetVolumeKm, 42)
    assert.deepEqual(reviewed.affectedMicrocycles[0].valueSources, {
      type: 'generated',
      targetVolumeKm: 'generated',
      targetElevationGainM: 'generated',
      allowIntenseSessions: 'generated',
    })
  })

  it('applies explicit coach edits and marks only edited values as coach-owned', () => {
    const reviewed = reviewCompetitionAdjustmentProposal({
      proposal: proposal(),
      decision: 'adjusted',
      edits: [{
        microcycleId: 'week-1',
        targetVolumeKm: 45,
        allowIntenseSessions: false,
      }],
    })

    const week = reviewed.affectedMicrocycles[0]
    assert.equal(week.reviewed.targetVolumeKm, 45)
    assert.equal(week.reviewed.targetElevationGainM, 1_300)
    assert.equal(week.reviewed.allowIntenseSessions, false)
    assert.equal(week.valueSources.targetVolumeKm, 'coach')
    assert.equal(week.valueSources.allowIntenseSessions, 'coach')
    assert.equal(week.valueSources.targetElevationGainM, 'generated')
  })

  it('does not allow coach review to overwrite fields protected by KAN-220', () => {
    assert.throws(() => reviewCompetitionAdjustmentProposal({
      proposal: proposal(['target_volume_km']),
      decision: 'adjusted',
      edits: [{ microcycleId: 'week-1', targetVolumeKm: 50 }],
    }), /Cannot edit protected field target_volume_km/)
  })

  it('rejects inconsistent review decisions and invalid edit targets', () => {
    assert.throws(() => reviewCompetitionAdjustmentProposal({
      proposal: proposal(),
      decision: 'accepted',
      edits: [{ microcycleId: 'week-1', targetVolumeKm: 45 }],
    }), /cannot contain coach edits/)

    assert.throws(() => reviewCompetitionAdjustmentProposal({
      proposal: proposal(),
      decision: 'adjusted',
      edits: [{ microcycleId: 'missing', targetVolumeKm: 45 }],
    }), /Unknown competition adjustment microcycle/)

    assert.throws(() => reviewCompetitionAdjustmentProposal({
      proposal: proposal(),
      decision: 'adjusted',
      edits: [{ microcycleId: 'week-1', targetElevationGainM: -1 }],
    }), /targetElevationGainM must be/)
  })
})
