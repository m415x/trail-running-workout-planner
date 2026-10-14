import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildGenerationExplanation, GENERATION_EXPLANATION_STAGE_ORDER } from '@/lib/session-generation/generation-explanation'
import { generateWeeklySessionProposals } from '@/lib/session-generation/session-proposal-generator'
import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import { verifyGenerationPreviewEquivalence } from '@/lib/session-generation/preview-equivalence'
import type { GenerationExplanation } from '@/lib/session-generation/generation-explanation'
import type { SessionGenerationInput, SharedSessionGenerationResult } from '@/types/training/session-generation.types'

type GenerationRun = { input: SessionGenerationInput; planningCohortId: string | null }

function fixtureRun(planningCohortId: string | null = null): GenerationRun {
  return {
    planningCohortId,
    input: {
      context: {
        teamId: 'team-787',
        groupTrainingPlanId: planningCohortId ? 'variant-787' : 'base-787',
        groupId: 'group-787',
        microcycleId: planningCohortId ? 'micro-variant-787' : 'micro-base-787',
        period: 'general_preparatory',
        microcycleType: 'development',
        startDate: '2026-09-21',
        endDate: '2026-09-27',
        load: { targetVolumeKm: 30, targetElevationGain: 900, maximumWeeklyVolumeKm: 50 },
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
        pattern: { slots: [
          { key: 'monday-base', weekday: 'monday', role: 'base', preferredWorkoutTypes: ['Base'], volumeWeight: 1, elevationWeight: 1 },
          { key: 'wednesday-quality', weekday: 'wednesday', role: 'quality', preferredWorkoutTypes: ['Intervals'], volumeWeight: 1, elevationWeight: 1 },
          { key: 'saturday-long', weekday: 'saturday', role: 'long', preferredWorkoutTypes: ['Long'], volumeWeight: 2, elevationWeight: 2 },
        ] },
      },
      templates: [],
    },
  }
}

function preview(runs: GenerationRun[]): {
  proposal: SharedSessionGenerationResult
  explanations: Record<string, GenerationExplanation>
} {
  const generated = runs.map(({ input }) => generateWeeklySessionProposals(input))
  const proposal = groupSharedSessionEvents(generated)
  const explanations: Record<string, GenerationExplanation> = {}
  generated.forEach((result, index) => {
    for (const item of result.proposals) {
      explanations[item.generationKey] = buildGenerationExplanation({
        input: runs[index].input,
        result,
        sharedGeneration: proposal,
        generationKey: item.generationKey,
        planningCohortId: runs[index].planningCohortId,
      })
    }
  })
  return { proposal, explanations }
}

test('KAN-787 same authoritative generation inputs reproduce exact reviewed Base/Variant proposal and all causal facts', () => {
  const runs = [fixtureRun(), fixtureRun('cohort-787')]
  const reviewed = preview(runs)
  const keys = Object.keys(reviewed.explanations).sort()
  assert.equal(keys.length, 6)
  for (const [key, explanation] of Object.entries(reviewed.explanations)) {
    assert.ok(key.startsWith(explanation.planningScope.groupTrainingPlanId + '::'))
    assert.deepEqual(explanation.stages.map(({ stage }) => stage), [...GENERATION_EXPLANATION_STAGE_ORDER])
    assert.ok(explanation.stages.every(stage =>
      ['inputs', 'constraints', 'decision', 'consequence', 'warnings'].every(field => field in stage)))
    assert.equal(explanation.planningScope.kind, key.startsWith('variant-787::') ? 'variant' : 'base')
    assert.equal(explanation.planningScope.planningCohortId,
      key.startsWith('variant-787::') ? 'cohort-787' : null)
  }
  assert.deepEqual(verifyGenerationPreviewEquivalence({
    authoritativeRuns: runs, reviewedProposal: reviewed.proposal, reviewedExplanations: reviewed.explanations,
  }), { status: 'equivalent' })
})

test('KAN-787 rejects stale intensity/weekly budget even if the client still presents the original preview', () => {
  const original = fixtureRun()
  const reviewed = preview([original])
  const changed: GenerationRun = structuredClone(original)
  changed.input.context.load.targetVolumeKm = 38
  changed.input.context.intensity.intenseSessionsTarget = 2
  assert.deepEqual(verifyGenerationPreviewEquivalence({
    authoritativeRuns: [changed], reviewedProposal: reviewed.proposal, reviewedExplanations: reviewed.explanations,
  }), { status: 'stale' })
})

test('KAN-787 rejects stale planning pattern and Base/Variant scope changes without accepting a client digest', () => {
  const original = fixtureRun('cohort-787')
  const reviewed = preview([original])
  const changed: GenerationRun = structuredClone(original)
  changed.input.context.pattern.slots[2].volumeWeight = 3
  assert.deepEqual(verifyGenerationPreviewEquivalence({
    authoritativeRuns: [changed], reviewedProposal: reviewed.proposal, reviewedExplanations: reviewed.explanations,
  }), { status: 'stale' })
  const wrongScope: GenerationRun = structuredClone(original)
  wrongScope.planningCohortId = 'different-cohort'
  assert.deepEqual(verifyGenerationPreviewEquivalence({
    authoritativeRuns: [wrongScope], reviewedProposal: reviewed.proposal, reviewedExplanations: reviewed.explanations,
  }), { status: 'stale' })
})

test('KAN-787 rejects client-edited causal facts even when proposal and generation keys match', () => {
  const runs = [fixtureRun()]
  const reviewed = preview(runs)
  const edited = structuredClone(reviewed.explanations)
  const key = Object.keys(edited)[0]
  edited[key].stages[0].inputs[0].value = 999
  assert.deepEqual(verifyGenerationPreviewEquivalence({
    authoritativeRuns: runs, reviewedProposal: reviewed.proposal, reviewedExplanations: edited,
  }), { status: 'stale' })
})
