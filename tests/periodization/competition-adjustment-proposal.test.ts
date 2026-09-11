import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildCompetitionAdjustmentProposal } from '@/lib/periodization/competition-adjustment-proposal'
import { buildFullCompetitionATaperProposal } from '@/lib/periodization/full-a-taper-proposal'
import { decidePostCompetitionRecovery } from '@/lib/periodization/post-competition-recovery-decision'

import type { Microcycle, PreCompetitionLoadContext, TaperIntensityReference } from '@/types'

const load: PreCompetitionLoadContext = {
  referenceWindowWeeks: 4,
  analyzedWeeks: 4,
  volume: {
    recentAverageKm: 60,
    achievedPeakVolumeKm: 68,
    trend: 'stable',
  },
  elevation: {
    recentAverageGainM: 2_000,
    achievedPeakElevationGainM: 2_300,
    trend: 'stable',
    knownWeeks: 4,
  },
}

const intensity: TaperIntensityReference = {
  emphasis: 'vo2max',
  intenseSessionsTarget: 2,
  predominantZone: 'Z2',
  pamPercentageTarget: 95,
  minimumRecoveryDaysBetweenIntenseSessions: 2,
}

function microcycle(
  id: string,
  weekNumber: number,
  startDate: string,
  endDate: string,
  type: Microcycle['type'],
  volumeKm: number,
  elevationGainM: number,
): Microcycle {
  return {
    id,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    mesocycleId: 'meso-1',
    weekNumber,
    type,
    startDate,
    endDate,
    targetVolumeKm: volumeKm,
    targetVolumeSource: 'generated',
    targetElevationGain: elevationGainM,
    targetElevationSource: 'generated',
  }
}

function source() {
  return buildFullCompetitionATaperProposal({
    competition: {
      competitionId: 'race-a',
      name: 'Trail A',
      date: '2026-10-18',
      priority: 'A',
      distanceKm: 42,
      elevationGainM: 1_500,
    },
    courseProfile: {
      distanceKm: 42,
      elevationGainM: 1_500,
      source: 'manual',
    },
    preCompetitionLoad: load,
    intensityReference: intensity,
  })
}

describe('local competition adjustment proposal', () => {
  it('previews only microcycles intersecting the local impact window', () => {
    const taper = source()
    const recovery = decidePostCompetitionRecovery({
      priority: 'A',
      courseProfile: taper.demand.profile,
      competitionDemand: taper.demand,
    })
    const proposal = buildCompetitionAdjustmentProposal({
      source: taper,
      recovery,
      existingMicrocycles: [
        microcycle('outside', 1, '2026-09-14', '2026-09-20', 'development', 60, 2_000),
        microcycle('pre', 2, '2026-10-05', '2026-10-11', 'development', 60, 2_000),
        microcycle('race', 3, '2026-10-12', '2026-10-18', 'development', 55, 1_800),
        microcycle('post', 4, '2026-10-19', '2026-10-25', 'development', 50, 1_500),
      ],
    })

    assert.deepEqual(proposal.affectedMicrocycles.map((item) => item.microcycleId), [
      'pre',
      'race',
      'post',
    ])
    assert.equal(proposal.window.competitionDate, '2026-10-18')
  })

  it('makes race-week training separate and visible in the preview', () => {
    const taper = source()
    const recovery = decidePostCompetitionRecovery({
      priority: 'A',
      courseProfile: taper.demand.profile,
      competitionDemand: taper.demand,
    })
    const proposal = buildCompetitionAdjustmentProposal({
      source: taper,
      recovery,
      existingMicrocycles: [
        microcycle('race', 3, '2026-10-12', '2026-10-18', 'development', 55, 1_800),
      ],
    })
    const preview = proposal.affectedMicrocycles[0]

    assert.equal(preview.proposed.type, 'race')
    assert.equal(preview.proposed.targetVolumeKm, taper.competitionWeek.training.volumeKm)
    assert.equal(preview.proposed.targetElevationGainM, taper.competitionWeek.training.elevationGainM)
    assert.ok(preview.reasonCodes.includes('race_week_training_separated'))
    assert.equal(proposal.rationale.competitionWeekTraining.volumeKm, taper.competitionWeek.training.volumeKm)
  })

  it('applies a conservative recovery ceiling to post-race microcycles', () => {
    const taper = source()
    const recovery = decidePostCompetitionRecovery({
      priority: 'A',
      courseProfile: taper.demand.profile,
      competitionDemand: taper.demand,
    })
    const proposal = buildCompetitionAdjustmentProposal({
      source: taper,
      recovery,
      existingMicrocycles: [
        microcycle('post', 4, '2026-10-19', '2026-10-25', 'development', 60, 2_000),
      ],
    })
    const preview = proposal.affectedMicrocycles[0]

    assert.ok((preview.proposed.targetVolumeKm ?? Infinity) < 60)
    assert.ok((preview.proposed.targetElevationGainM ?? Infinity) < 2_000)
    assert.equal(preview.proposed.allowIntenseSessions, false)
    assert.ok(preview.reasonCodes.includes('post_race_recovery_ceiling'))
  })

  it('surfaces only overlap conflicts that require coach review', () => {
    const taper = source()
    const recovery = decidePostCompetitionRecovery({
      priority: 'A',
      courseProfile: taper.demand.profile,
      competitionDemand: taper.demand,
    })
    const proposal = buildCompetitionAdjustmentProposal({
      source: taper,
      recovery,
      existingMicrocycles: [],
      overlaps: [
        {
          firstCompetitionId: 'race-a',
          secondCompetitionId: 'race-b',
          overlapStartDate: '2026-10-16',
          overlapEndDate: '2026-10-18',
          resolution: 'coach_review_required',
          dominantCompetitionId: null,
          requiresCoachReview: true,
          reasonCodes: ['pre_or_race_overlap', 'same_priority_overlap'],
        },
        {
          firstCompetitionId: 'race-a',
          secondCompetitionId: 'race-c',
          overlapStartDate: '2026-10-19',
          overlapEndDate: '2026-10-20',
          resolution: 'recovery_preserved',
          dominantCompetitionId: null,
          requiresCoachReview: false,
          reasonCodes: ['recovery_overlap', 'recovery_cannot_be_discarded'],
        },
      ],
    })

    assert.equal(proposal.conflicts.length, 1)
    assert.equal(proposal.conflicts[0].code, 'competition_window_overlap_requires_review')
    assert.equal(proposal.requiresCoachReview, true)
  })
})
