import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getCompetitionAdjustmentPolicy } from '@/lib/periodization/competition-adjustment-policy'

describe('competition adjustment policy', () => {
  it('uses full taper guardrails for A priority', () => {
    const policy = getCompetitionAdjustmentPolicy('A')

    assert.deepEqual(policy.taperDurationDays, { min: 4, max: 21 })
    assert.deepEqual(policy.volumeReductionPercentage, { min: 30, max: 60 })
    assert.equal(policy.defaultStrategy, 'full_taper')
    assert.equal(policy.allowNoFormalTaper, false)
    assert.equal(policy.allowCompetitionAsTrainingStimulus, false)
    assert.equal(policy.preserveBriefIntensityStimuli, true)
    assert.equal(policy.postCompetitionPlanningProtection, 'protected')
  })

  it('allows proportional local adjustment for B priority', () => {
    const policy = getCompetitionAdjustmentPolicy('B')

    assert.deepEqual(policy.taperDurationDays, { min: 0, max: 7 })
    assert.deepEqual(policy.volumeReductionPercentage, { min: 0, max: 40 })
    assert.equal(policy.defaultStrategy, 'proportional_adjustment')
    assert.equal(policy.allowNoFormalTaper, true)
    assert.equal(policy.allowCompetitionAsTrainingStimulus, false)
    assert.equal(policy.postCompetitionPlanningProtection, 'contextual')
  })

  it('allows C priority to act as a specific training stimulus', () => {
    const policy = getCompetitionAdjustmentPolicy('C')

    assert.deepEqual(policy.taperDurationDays, { min: 0, max: 3 })
    assert.deepEqual(policy.volumeReductionPercentage, { min: 0, max: 20 })
    assert.equal(policy.defaultStrategy, 'specific_stimulus')
    assert.equal(policy.allowNoFormalTaper, true)
    assert.equal(policy.allowCompetitionAsTrainingStimulus, true)
    assert.equal(policy.postCompetitionPlanningProtection, 'minimal_interference')
  })

  it('keeps intensity preservation available across every priority', () => {
    assert.equal(
      (['A', 'B', 'C'] as const).every((priority) => (
        getCompetitionAdjustmentPolicy(priority).preserveBriefIntensityStimuli
      )),
      true,
    )
  })
})
