import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decideTaperIntensityPreservation } from '@/lib/periodization/taper-intensity-preservation'

import type {
  CompetitionPriority,
  NumericRange,
  TaperDurationDecision,
  TaperIntensityReference,
} from '@/types'

function decision(
  priority: CompetitionPriority,
  durationDays: number,
  policyLimitsDays: NumericRange,
): TaperDurationDecision {
  return {
    priority,
    strategy: priority === 'A'
      ? 'full_taper'
      : priority === 'B'
        ? 'proportional_adjustment'
        : 'specific_stimulus',
    durationDays,
    policyLimitsDays,
    demandPositionRange: { min: 0, max: 1 },
    reachedLoadPosition: 0.5,
    requiresCoachReview: false,
    rationale: {
      demandBand: 'moderate',
      demandConfidence: 'medium',
      volumeTrend: 'stable',
      elevationTrend: 'stable',
      volumeSustainedLoadRatio: 0.8,
      elevationSustainedLoadRatio: 0.8,
      reasonCodes: ['priority_guardrail', 'course_demand', 'reached_load'],
    },
  }
}

const reference: TaperIntensityReference = {
  emphasis: 'vo2max',
  intenseSessionsTarget: 2,
  predominantZone: 'Z2',
  pamPercentageTarget: 95,
  minimumRecoveryDaysBetweenIntenseSessions: 2,
}

describe('taper intensity preservation', () => {
  it('preserves PAM magnitude while reducing quality-session count to a brief exposure', () => {
    const result = decideTaperIntensityPreservation(
      decision('A', 10, { min: 4, max: 21 }),
      reference,
    )

    assert.equal(result.proposed.intenseSessionsTarget, 1)
    assert.equal(result.proposed.pamPercentageTarget, 95)
    assert.equal(result.proposed.predominantZone, 'Z2')
    assert.equal(result.proposed.minimumRecoveryDaysBetweenIntenseSessions, 2)
    assert.equal(result.preserveBriefIntensityStimuli, true)
    assert.ok(result.reasonCodes.includes('brief_intensity_preserved'))
    assert.ok(result.reasonCodes.includes('intense_session_count_reduced'))
    assert.ok(result.reasonCodes.includes('existing_pam_percentage_preserved'))
  })

  it('does not fabricate a PAM target for an HR-zone-only week', () => {
    const hrReference: TaperIntensityReference = {
      ...reference,
      emphasis: 'aerobic',
      intenseSessionsTarget: 1,
      predominantZone: 'Z2',
      pamPercentageTarget: null,
    }

    const result = decideTaperIntensityPreservation(
      decision('B', 5, { min: 0, max: 7 }),
      hrReference,
    )

    assert.equal(result.proposed.intenseSessionsTarget, 1)
    assert.equal(result.proposed.predominantZone, 'Z2')
    assert.equal(result.proposed.pamPercentageTarget, null)
    assert.ok(result.reasonCodes.includes('existing_hr_zone_preserved'))
    assert.equal(result.reasonCodes.includes('existing_pam_percentage_preserved'), false)
  })

  it('does not create an intense stimulus when the reference week has none', () => {
    const recoveryReference: TaperIntensityReference = {
      ...reference,
      emphasis: 'recovery',
      intenseSessionsTarget: 0,
      predominantZone: 'Z1',
      pamPercentageTarget: null,
    }

    const result = decideTaperIntensityPreservation(
      decision('A', 7, { min: 4, max: 21 }),
      recoveryReference,
    )

    assert.equal(result.proposed.intenseSessionsTarget, 0)
    assert.equal(result.preserveBriefIntensityStimuli, false)
  })

  it('leaves the weekly intensity target untouched when there is no formal taper', () => {
    const result = decideTaperIntensityPreservation(
      decision('C', 0, { min: 0, max: 3 }),
      reference,
    )

    assert.deepEqual(result.proposed, reference)
    assert.equal(result.preserveBriefIntensityStimuli, false)
    assert.deepEqual(result.reasonCodes, ['no_formal_taper'])
  })

  it('rejects invalid PAM percentages rather than inventing intensity semantics', () => {
    assert.throws(
      () => decideTaperIntensityPreservation(
        decision('A', 7, { min: 4, max: 21 }),
        { ...reference, pamPercentageTarget: 0 },
      ),
      /PAM percentage target/,
    )
  })
})
