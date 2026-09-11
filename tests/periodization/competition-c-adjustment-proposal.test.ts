import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildCompetitionCAdjustmentProposal } from '@/lib/periodization/competition-c-adjustment-proposal'

import type {
  CompetitionCAdjustmentInput,
  PreCompetitionLoadContext,
  TaperIntensityReference,
} from '@/types'

const load: PreCompetitionLoadContext = {
  referenceWindowWeeks: 4,
  analyzedWeeks: 4,
  volume: {
    recentAverageKm: 48,
    achievedPeakVolumeKm: 55,
    trend: 'stable',
  },
  elevation: {
    recentAverageGainM: 1_500,
    achievedPeakElevationGainM: 1_800,
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

function input(overrides: Partial<CompetitionCAdjustmentInput> = {}): CompetitionCAdjustmentInput {
  return {
    competition: {
      competitionId: 'race-c',
      name: 'Carrera C',
      date: '2026-10-04',
      priority: 'C',
      distanceKm: 10,
      elevationGainM: 200,
    },
    courseProfile: {
      distanceKm: 10,
      elevationGainM: 200,
      source: 'manual',
    },
    preCompetitionLoad: load,
    intensityReference: intensity,
    competitionWeekContext: {
      role: 'development',
      plannedTraining: {
        volumeKm: 45,
        elevationGainM: 1_300,
      },
    },
    ...overrides,
  }
}

describe('competition C specific stimulus proposal', () => {
  it('can treat a short C as a planned quality stimulus', () => {
    const proposal = buildCompetitionCAdjustmentProposal(input())

    assert.equal(proposal.priority, 'C')
    assert.equal(proposal.strategy, 'specific_stimulus')
    assert.equal(proposal.treatment, 'training_stimulus')
    assert.equal(proposal.competitionActsAsQualityStimulus, true)
    assert.equal(proposal.demand.band, 'very_low')
    assert.ok(proposal.duration.durationDays >= 0)
    assert.ok(proposal.duration.durationDays <= 3)
  })

  it('uses the competition to replace one planned quality exposure without changing PAM magnitude', () => {
    const proposal = buildCompetitionCAdjustmentProposal(input())

    assert.equal(proposal.intensity.proposed.pamPercentageTarget, 95)
    assert.equal(
      proposal.intensity.proposed.intenseSessionsTarget,
      Math.max(0, proposal.intensity.reference.intenseSessionsTarget - 1),
    )
  })

  it('does not force a recovery week to become a quality-stimulus week', () => {
    const proposal = buildCompetitionCAdjustmentProposal(input({
      competitionWeekContext: {
        role: 'recovery',
        plannedTraining: {
          volumeKm: 26,
          elevationGainM: 600,
        },
      },
    }))

    assert.equal(proposal.treatment, 'minimal_adjustment')
    assert.equal(proposal.competitionActsAsQualityStimulus, false)
    assert.ok(proposal.competitionWeek.training.volumeKm <= 26)
    assert.ok((proposal.competitionWeek.training.elevationGainM ?? 0) <= 600)
  })

  it('keeps a physiologically demanding C visible despite its secondary priority', () => {
    const proposal = buildCompetitionCAdjustmentProposal(input({
      competition: {
        competitionId: 'ultra-c',
        name: 'Ultra C',
        date: '2026-11-01',
        priority: 'C',
        distanceKm: 80,
        elevationGainM: 5_000,
      },
      courseProfile: {
        distanceKm: 80,
        elevationGainM: 5_000,
        source: 'manual',
      },
    }))

    assert.ok(['high', 'very_high', 'extreme'].includes(proposal.demand.band))
    assert.equal(proposal.treatment, 'minimal_adjustment')
    assert.equal(proposal.competitionActsAsQualityStimulus, false)
    assert.equal(proposal.physiologicalDemandRequiresRecoveryReview, true)
  })

  it('keeps race exposure separate from the training prescription', () => {
    const proposal = buildCompetitionCAdjustmentProposal(input())

    assert.equal(proposal.competitionWeek.competition.priority, 'C')
    assert.equal(proposal.competitionWeek.competition.distanceKm, 10)
    assert.equal(
      proposal.competitionWeek.totalExposure.distanceKm,
      proposal.competitionWeek.training.volumeKm + 10,
    )
  })

  it('propagates unknown course demand to coach review instead of assuming a light C', () => {
    const proposal = buildCompetitionCAdjustmentProposal(input({
      competition: {
        competitionId: 'unknown-c',
        name: 'C sin D+',
        date: '2026-10-04',
        priority: 'C',
        distanceKm: 20,
        elevationGainM: null,
      },
      courseProfile: {
        distanceKm: 20,
        elevationGainM: null,
        source: 'manual',
      },
    }))

    assert.equal(proposal.demand.band, 'unknown')
    assert.equal(proposal.competitionActsAsQualityStimulus, false)
    assert.equal(proposal.requiresCoachReview, true)
  })

  it('rejects A/B competitions', () => {
    assert.throws(
      () => buildCompetitionCAdjustmentProposal(input({
        competition: {
          competitionId: 'race-b',
          name: 'Carrera B',
          date: '2026-10-04',
          priority: 'B',
          distanceKm: 10,
          elevationGainM: 200,
        },
      })),
      /C-priority competition/,
    )
  })
})
