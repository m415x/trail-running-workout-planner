import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildCompetitionBAdjustmentProposal } from '@/lib/periodization/competition-b-adjustment-proposal'

import type {
  CompetitionBAdjustmentInput,
  PreCompetitionLoadContext,
  TaperIntensityReference,
} from '@/types'

const load: PreCompetitionLoadContext = {
  referenceWindowWeeks: 4,
  analyzedWeeks: 4,
  volume: {
    recentAverageKm: 54,
    achievedPeakVolumeKm: 60,
    trend: 'stable',
  },
  elevation: {
    recentAverageGainM: 1_800,
    achievedPeakElevationGainM: 2_000,
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

function input(overrides: Partial<CompetitionBAdjustmentInput> = {}): CompetitionBAdjustmentInput {
  return {
    competition: {
      competitionId: 'race-b',
      name: 'Carrera B',
      date: '2026-10-18',
      priority: 'B',
      distanceKm: 25,
      elevationGainM: 900,
    },
    courseProfile: {
      distanceKm: 25,
      elevationGainM: 900,
      source: 'manual',
    },
    preCompetitionLoad: load,
    intensityReference: intensity,
    competitionWeekContext: {
      role: 'development',
      plannedTraining: {
        volumeKm: 50,
        elevationGainM: 1_600,
      },
    },
    ...overrides,
  }
}

describe('competition B proportional adjustment proposal', () => {
  it('keeps B as a proportional local adjustment instead of a primary peak', () => {
    const proposal = buildCompetitionBAdjustmentProposal(input())

    assert.equal(proposal.priority, 'B')
    assert.equal(proposal.strategy, 'proportional_adjustment')
    assert.ok(proposal.duration.durationDays >= 0)
    assert.ok(proposal.duration.durationDays <= 7)
    assert.equal(proposal.competitionWeekRole, 'development')
  })

  it('reduces a development week only as far as the mini-taper requires', () => {
    const proposal = buildCompetitionBAdjustmentProposal(input())

    assert.ok(proposal.duration.durationDays > 0)
    assert.ok(proposal.competitionWeek.training.volumeKm <= 50)
    assert.ok((proposal.competitionWeek.training.elevationGainM ?? 0) <= 1_600)
    assert.equal(proposal.competitionWeek.competition.distanceKm, 25)
  })

  it('does not increase a nearby recovery week', () => {
    const proposal = buildCompetitionBAdjustmentProposal(input({
      competitionWeekContext: {
        role: 'recovery',
        plannedTraining: {
          volumeKm: 28,
          elevationGainM: 700,
        },
      },
    }))

    assert.equal(proposal.competitionWeekRole, 'recovery')
    assert.ok(proposal.competitionWeek.training.volumeKm <= 28)
    assert.ok((proposal.competitionWeek.training.elevationGainM ?? 0) <= 700)
  })

  it('keeps competition exposure separate from the adjusted training target', () => {
    const proposal = buildCompetitionBAdjustmentProposal(input())

    assert.equal(proposal.competitionWeek.competition.priority, 'B')
    assert.equal(
      proposal.competitionWeek.totalExposure.distanceKm,
      proposal.competitionWeek.training.volumeKm + 25,
    )
  })

  it('preserves PAM magnitude while limiting the quality exposure during a mini-taper', () => {
    const proposal = buildCompetitionBAdjustmentProposal(input())

    assert.equal(proposal.intensity.proposed.pamPercentageTarget, 95)
    assert.ok(proposal.intensity.proposed.intenseSessionsTarget <= 1)
  })

  it('surfaces coach review when course demand is uncertain', () => {
    const proposal = buildCompetitionBAdjustmentProposal(input({
      competition: {
        competitionId: 'unknown-b',
        name: 'B sin D+',
        date: '2026-10-18',
        priority: 'B',
        distanceKm: 25,
        elevationGainM: null,
      },
      courseProfile: {
        distanceKm: 25,
        elevationGainM: null,
        source: 'manual',
      },
    }))

    assert.equal(proposal.demand.band, 'unknown')
    assert.equal(proposal.requiresCoachReview, true)
  })

  it('rejects A/C competitions', () => {
    assert.throws(
      () => buildCompetitionBAdjustmentProposal(input({
        competition: {
          competitionId: 'race-a',
          name: 'Carrera A',
          date: '2026-10-18',
          priority: 'A',
          distanceKm: 25,
          elevationGainM: 900,
        },
      })),
      /B-priority competition/,
    )
  })
})
