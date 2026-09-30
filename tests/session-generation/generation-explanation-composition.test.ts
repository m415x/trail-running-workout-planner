import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  GENERATION_EXPLANATION_STAGE_ORDER,
  buildGenerationExplanation,
} from '@/lib/session-generation/generation-explanation'
import type {
  SessionGenerationInput,
  SessionGenerationResult,
  SharedSessionGenerationResult,
} from '@/types/training/session-generation.types'

test('buildGenerationExplanation composes the approved causal stages from generation truth', () => {
  const input = fixtureInput()
  const result = fixtureResult()
  const shared = fixtureShared(result)

  const explanation = buildGenerationExplanation({
    input,
    result,
    sharedGeneration: shared,
    generationKey: result.proposals[0].generationKey,
    planningCohortId: null,
  })

  assert.deepEqual(
    explanation.stages.map(({ stage }) => stage),
    [...GENERATION_EXPLANATION_STAGE_ORDER],
  )
  assert.deepEqual(explanation.planningScope, {
    kind: 'base',
    groupTrainingPlanId: 'plan-1',
    groupId: 'group-1',
    planningCohortId: null,
    microcycleId: 'micro-1',
  })

  const budget = explanation.stages[0]
  assert.equal(budget.stage, 'weekly_budget')
  assert.ok(budget.inputs.some(({ code, value }) => code === 'target_volume_km' && value === 30))
  assert.ok(budget.inputs.some(({ code, value }) => code === 'target_elevation_gain' && value === 900))
})

test('historical composition strips localized source_warning facts', () => {
  const input = fixtureInput()
  const result = fixtureResult()
  const shared = fixtureShared(result)

  const explanation = buildGenerationExplanation({
    input,
    result,
    sharedGeneration: shared,
    generationKey: result.proposals[0].generationKey,
    planningCohortId: null,
  })

  for (const stage of explanation.stages) {
    for (const warning of stage.warnings) {
      assert.equal(
        warning.facts.some(({ code }) => code === 'source_warning'),
        false,
      )
    }
  }
})

function fixtureInput(): SessionGenerationInput {
  return {
    context: {
      teamId: 'team-1',
      groupTrainingPlanId: 'plan-1',
      groupId: 'group-1',
      microcycleId: 'micro-1',
      period: 'general_preparatory',
      microcycleType: 'development',
      startDate: '2026-09-21',
      endDate: '2026-09-27',
      load: {
        targetVolumeKm: 30,
        targetElevationGain: 900,
        maximumWeeklyVolumeKm: 50,
      },
      intensity: {
        defaultMethod: 'hr_zone',
        emphasis: 'aerobic',
        intenseSessionsTarget: 1,
        predominantZone: 'Z2',
        referencePercentageTarget: null,
        minimumRecoveryDaysBetweenIntenseSessions: 1,
      },
      competition: null,
      frequency: { mode: 'fixed', sessionsPerWeek: 3 },
      pattern: {
        slots: [
          { key: 'monday-base', weekday: 'monday', role: 'base', preferredWorkoutTypes: ['Base'], volumeWeight: 1, elevationWeight: 1 },
          { key: 'wednesday-quality', weekday: 'wednesday', role: 'quality', preferredWorkoutTypes: ['Intervals'], volumeWeight: 1, elevationWeight: 1 },
          { key: 'saturday-long', weekday: 'saturday', role: 'long', preferredWorkoutTypes: ['Long'], volumeWeight: 2, elevationWeight: 2 },
        ],
      },
    },
    templates: [],
  }
}

function fixtureResult(): SessionGenerationResult {
  return {
    proposals: [{
      generationKey: 'plan-1::micro-1::group-1::monday-base',
      sharedEventKey: 'team-1::2026-09-21::base',
      slotKey: 'monday-base',
      role: 'base',
      session: {
        date: '2026-09-21',
        title: 'Base',
        type: 'Base',
        sourceTemplateId: null,
        locationKey: null,
        trackPath: null,
        structure: null,
        notes: null,
      },
      prescription: {
        groupId: 'group-1',
        microcycleId: 'micro-1',
        distanceKm: 10,
        durationMin: null,
        elevationGain: 300,
        intensityMethod: 'hr_zone',
        zone: 'Z2',
        referencePercentage: null,
        notes: null,
      },
      warnings: [],
    }],
    warnings: [],
  }
}

function fixtureShared(result: SessionGenerationResult): SharedSessionGenerationResult {
  const proposal = result.proposals[0]
  return {
    events: [{
      sharedEventKey: proposal.sharedEventKey,
      session: proposal.session,
      prescriptions: [{
        generationKey: proposal.generationKey,
        slotKey: proposal.slotKey,
        role: proposal.role,
        prescription: proposal.prescription,
        warnings: proposal.warnings,
      }],
      warnings: [],
    }],
    warnings: [],
  }
}
