import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildFullCompetitionATaperProposal } from '@/lib/periodization/full-a-taper-proposal'

import type {
  FullCompetitionATaperInput,
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

function input(overrides: Partial<FullCompetitionATaperInput> = {}): FullCompetitionATaperInput {
  return {
    competition: {
      competitionId: 'race-a',
      name: 'Carrera A',
      date: '2026-11-15',
      priority: 'A',
      distanceKm: 12,
      elevationGainM: 300,
    },
    courseProfile: {
      distanceKm: 12,
      elevationGainM: 300,
      source: 'manual',
    },
    preCompetitionLoad: load,
    intensityReference: intensity,
    ...overrides,
  }
}

describe('full A taper proposal', () => {
  it('allows a short A competition to use less than two weeks of taper', () => {
    const proposal = buildFullCompetitionATaperProposal(input())

    assert.equal(proposal.priority, 'A')
    assert.equal(proposal.demand.band, 'very_low')
    assert.ok(proposal.duration.durationDays >= 4)
    assert.ok(proposal.duration.durationDays < 14)
    assert.equal(proposal.volumeCurve.points.length, proposal.duration.durationDays)
    assert.equal(proposal.elevationCurve.points.length, proposal.duration.durationDays)
  })

  it('gives an extreme ultra a substantially longer taper than a short A race', () => {
    const shortProposal = buildFullCompetitionATaperProposal(input())
    const ultraProposal = buildFullCompetitionATaperProposal(input({
      competition: {
        competitionId: 'ultra-a',
        name: 'Ultra A',
        date: '2027-02-20',
        priority: 'A',
        distanceKm: 100,
        elevationGainM: 6_000,
      },
      courseProfile: {
        distanceKm: 100,
        elevationGainM: 6_000,
        source: 'manual',
      },
    }))

    assert.equal(ultraProposal.demand.band, 'extreme')
    assert.ok(ultraProposal.duration.durationDays > 14)
    assert.ok(ultraProposal.duration.durationDays > shortProposal.duration.durationDays)
  })

  it('composes volume, D+ and intensity policies without weakening PAM magnitude', () => {
    const proposal = buildFullCompetitionATaperProposal(input())

    assert.equal(proposal.intensity.proposed.intenseSessionsTarget, 1)
    assert.equal(proposal.intensity.proposed.pamPercentageTarget, 95)
    assert.ok(proposal.volumeCurve.finalReductionPercentage > 0)
    assert.ok((proposal.elevationCurve.finalReductionPercentage ?? 0) > 0)
  })

  it('keeps competition exposure separate from race-week training load', () => {
    const proposal = buildFullCompetitionATaperProposal(input())
    const finalVolumePoint = proposal.volumeCurve.points.at(-1)!
    const finalElevationPoint = proposal.elevationCurve.points.at(-1)!

    assert.equal(
      proposal.competitionWeek.training.volumeKm,
      finalVolumePoint.targetWeeklyEquivalentVolumeKm,
    )
    assert.equal(
      proposal.competitionWeek.training.elevationGainM,
      finalElevationPoint.targetWeeklyEquivalentElevationGainM,
    )
    assert.equal(proposal.competitionWeek.competition.distanceKm, 12)
    assert.equal(proposal.competitionWeek.competition.elevationGainM, 300)
    assert.equal(
      proposal.competitionWeek.totalExposure.distanceKm,
      proposal.competitionWeek.training.volumeKm + 12,
    )
  })

  it('surfaces coach review when course D+ is unknown instead of assuming flat terrain', () => {
    const proposal = buildFullCompetitionATaperProposal(input({
      competition: {
        competitionId: 'unknown-dplus-a',
        name: 'Carrera sin D+',
        date: '2026-12-01',
        priority: 'A',
        distanceKm: 30,
        elevationGainM: null,
      },
      courseProfile: {
        distanceKm: 30,
        elevationGainM: null,
        source: 'manual',
      },
    }))

    assert.equal(proposal.demand.band, 'unknown')
    assert.equal(proposal.requiresCoachReview, true)
    assert.equal(proposal.elevationCurve.specificity, 'unknown')
  })

  it('rejects B/C competitions because this policy is exclusively for primary A', () => {
    assert.throws(
      () => buildFullCompetitionATaperProposal(input({
        competition: {
          competitionId: 'race-b',
          name: 'Carrera B',
          date: '2026-10-01',
          priority: 'B',
          distanceKm: 20,
          elevationGainM: 800,
        },
      })),
      /A-priority competition/,
    )
  })
})
