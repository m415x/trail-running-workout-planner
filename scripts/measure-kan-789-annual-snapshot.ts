/**
 * KAN-789/T4: deterministic capacity measurement using the production generator.
 * Pure inputs only: no SQLite connection, sessions, persistence or private data.
 * Representative scenario, NOT a recovery of the historical 239-session Coach review.
 *
 * Run: pn exec tsx scripts/measure-kan-789-annual-snapshot.ts
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'
import {
  buildGenerationExplanation,
  GENERATION_EXPLANATION_STAGE_ORDER,
} from '@/lib/session-generation/generation-explanation'
import { generateWeeklySessionProposals } from '@/lib/session-generation/session-proposal-generator'
import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import { SESSION_GENERATION_SNAPSHOT_LIMITS } from '@/lib/session-generation/review-snapshot-limits'
import type { SessionGenerationInput, SessionGenerationResult } from '@/types/training/session-generation.types'
import type { WorkoutTemplate } from '@/types/training/workout-template.types'

const mode = process.argv.includes('--scenario=base-variant') ? 'base-variant' : 'base'
if (process.argv.some(arg => arg.startsWith('--scenario=') && arg !== '--scenario=base-variant' && arg !== '--scenario=base')) {
  throw new Error('Unknown capacity scenario (supported: base, base-variant)')
}

const VARIANT = Object.freeze({
  planId: 'capacity-fixture-variant-plan',
  planningCohortId: 'capacity-fixture-cohort',
  sourceGroupTrainingPlanId: 'capacity-fixture-plan',
  teamId: 'capacity-fixture-team',
  groupId: 'capacity-fixture-group',
  // Same calendar, session identities and templates; independent scope and load.
  weeklyVolumeFactor: 0.9,
  weeklyElevationFactor: 0.85,
})

const SCENARIO = {
  scenarioVersion: 'kan-789-annual-pure-v1',
  startDate: '2026-01-05',
  microcycles: 53,
  weeksPerPhase: 13,
  teamId: 'capacity-fixture-team',
  groupId: 'capacity-fixture-group',
  planId: 'capacity-fixture-plan',
  planningCohortId: null,
  // Intentional actual-generator 4/week baseline. Do not manufacture 239.
  fixedSessionsPerWeek: 4,
  initialWeeklyVolumeKm: 32,
  volumeIncrementKmPerWeek: 0.4,
  maxWeeklyVolumeKm: 65,
  targetWeeklyElevationGain: 700,
  // Explicit no-race baseline: competition is a separate capacity scenario.
  competition: null,
} as const

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
function bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}
function isoDate(start: string, days: number): string {
  const date = new Date(start + 'T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
function template(id: string, category: WorkoutTemplate['category'], type: WorkoutTemplate['sessionDefaults']['type']): WorkoutTemplate {
  return {
    id, teamId: SCENARIO.teamId, category, tags: [], archivedAt: null,
    createdAt: SCENARIO.startDate, updatedAt: SCENARIO.startDate, isDeleted: false,
    sessionDefaults: { title: 'Capacity ' + id, type, locationKey: null,
      trackPath: null, structure: { mainBlock: 'Deterministic capacity exercise' }, notes: null },
    prescriptionDefaults: { distanceKm: null, durationMin: null,
      elevationGain: null, intensity: null, notes: null },
  }
}
const templates: WorkoutTemplate[] = [
  template('capacity-mountain', 'mountain', 'Trail'),
  template('capacity-quality', 'quality', 'PAM'),
  template('capacity-endurance', 'endurance', 'Long'),
  template('capacity-recovery', 'recovery', 'Base'),
]

function weeklyInput(weekIndex: number): SessionGenerationInput {
  const period: SessionGenerationInput['context']['period'] =
    weekIndex < 13 ? 'general_preparatory' : weekIndex < 39 ? 'specific_preparatory' : 'competitive'
  const microcycleType: SessionGenerationInput['context']['microcycleType'] =
    weekIndex % 4 === 3 ? 'deload' : 'development'
  return {
    context: {
      teamId: SCENARIO.teamId,
      groupTrainingPlanId: SCENARIO.planId,
      groupId: SCENARIO.groupId,
      microcycleId: 'capacity-week-' + String(weekIndex + 1).padStart(2, '0'),
      period, microcycleType,
      startDate: isoDate(SCENARIO.startDate, 7 * weekIndex),
      endDate: isoDate(SCENARIO.startDate, 7 * weekIndex + 6),
      load: {
        targetVolumeKm: Math.min(SCENARIO.maxWeeklyVolumeKm,
          SCENARIO.initialWeeklyVolumeKm + SCENARIO.volumeIncrementKmPerWeek * weekIndex),
        targetElevationGain: SCENARIO.targetWeeklyElevationGain,
        maximumWeeklyVolumeKm: SCENARIO.maxWeeklyVolumeKm,
      },
      intensity: {
        defaultMethod: 'reference_percentage', emphasis: 'vo2max',
        intenseSessionsTarget: 1, predominantZone: 'Z2',
        referencePercentageTarget: 95,
        minimumRecoveryDaysBetweenIntenseSessions: 2,
      },
      competition: SCENARIO.competition,
      frequency: { mode: 'fixed', sessionsPerWeek: SCENARIO.fixedSessionsPerWeek },
      pattern: DEFAULT_WEEKLY_TRAINING_PATTERN,
    },
    templates,
  }
}

function variantWeeklyInput(base: SessionGenerationInput): SessionGenerationInput {
  if (base.context.groupTrainingPlanId !== VARIANT.sourceGroupTrainingPlanId ||
      base.context.teamId !== VARIANT.teamId || base.context.groupId !== VARIANT.groupId) {
    throw new Error('Invalid Base/Variant derivation hierarchy')
  }
  return {
    ...base,
    context: {
      ...base.context,
      groupTrainingPlanId: VARIANT.planId,
      microcycleId: base.context.microcycleId.replace('capacity-week-', 'capacity-variant-week-'),
      load: {
        ...base.context.load,
        targetVolumeKm: base.context.load.targetVolumeKm * VARIANT.weeklyVolumeFactor,
        targetElevationGain: base.context.load.targetElevationGain === null ? null :
          base.context.load.targetElevationGain * VARIANT.weeklyElevationFactor,
      },
    },
  }
}

function measure(): void {
  const runs: Array<{ input: SessionGenerationInput; result: SessionGenerationResult; scope: 'base' | 'variant' }> = []
  const byWeek: Array<{ week: number; startDate: string; proposals: number; warnings: number;
    baseProposals?: number; variantProposals?: number }> = []
  for (let index = 0; index < SCENARIO.microcycles; index++) {
    const input = weeklyInput(index)
    const result = generateWeeklySessionProposals(input)
    runs.push({ input, result, scope: 'base' })
    let variantResult: SessionGenerationResult | undefined
    if (mode === 'base-variant') {
      const variantInput = variantWeeklyInput(input)
      variantResult = generateWeeklySessionProposals(variantInput)
      runs.push({ input: variantInput, result: variantResult, scope: 'variant' })
    }
    byWeek.push({ week: index + 1, startDate: input.context.startDate,
      proposals: result.proposals.length + (variantResult?.proposals.length ?? 0),
      warnings: result.warnings.length + (variantResult?.warnings.length ?? 0),
      ...(variantResult ? { baseProposals: result.proposals.length,
        variantProposals: variantResult.proposals.length } : {}),
    })
  }

  const proposal = groupSharedSessionEvents(runs.map(({ result }) => result))
  const explanations: Record<string, ReturnType<typeof buildGenerationExplanation>> = {}
  for (const { input, result, scope } of runs) {
    for (const item of result.proposals) {
      if (explanations[item.generationKey]) throw new Error('Duplicate generationKey across scopes')
      explanations[item.generationKey] = buildGenerationExplanation({
        input, result, sharedGeneration: proposal,
        generationKey: item.generationKey,
        planningCohortId: scope === 'variant' ? VARIANT.planningCohortId : null,
      })
      const actualScope = explanations[item.generationKey].planningScope
      if (actualScope.kind !== scope ||
          actualScope.groupTrainingPlanId !== input.context.groupTrainingPlanId ||
          actualScope.microcycleId !== item.prescription.microcycleId ||
          actualScope.groupId !== input.context.groupId ||
          actualScope.planningCohortId !== (scope === 'variant' ? VARIANT.planningCohortId : null)) {
        throw new Error('Generation explanation planningScope did not match its prescription')
      }
    }
  }
  if (explanations && Object.keys(explanations).length !==
      proposal.events.reduce((sum, event) => sum + event.prescriptions.length, 0)) {
    throw new Error('Missing explanation for a consolidated prescription')
  }
  const generationKeys = new Set(Object.keys(explanations))
  for (const event of proposal.events) {
    const identities = new Set<string>()
    for (const prescription of event.prescriptions) {
      if (!generationKeys.has(prescription.generationKey) ||
          identities.has(prescription.prescription.microcycleId)) {
        throw new Error('Duplicate planning scope or missing explanation in shared event')
      }
      identities.add(prescription.prescription.microcycleId)
    }
  }

  const eventCounts = proposal.events.map(event => event.prescriptions.length)
  const prescriptions = eventCounts.reduce((sum, count) => sum + count, 0)
  const explanationValues = Object.values(explanations)
  const stageCounts = explanationValues.map(explanation => explanation.stages.length)
  const individualExplanationBytes = explanationValues.map(bytes)
  const factTotalsByStage: Record<string, { count: number; maxFacts: number; warnings: number; warningFacts: number }> = {}
  let maximumFactsPerStage = 0
  let maximumWarningsPerStage = 0
  let warningsTotal = 0
  let warningFactsTotal = 0
  for (const explanation of explanationValues) {
    for (const stage of explanation.stages) {
      const warningFacts = stage.warnings.reduce((sum, warning) => sum + warning.facts.length, 0)
      const facts = stage.inputs.length + stage.constraints.length + stage.decision.length +
        stage.consequence.length + warningFacts
      const stats = factTotalsByStage[stage.stage] ?? { count: 0, maxFacts: 0, warnings: 0, warningFacts: 0 }
      stats.count++
      stats.maxFacts = Math.max(stats.maxFacts, facts)
      stats.warnings += stage.warnings.length
      stats.warningFacts += warningFacts
      factTotalsByStage[stage.stage] = stats
      maximumFactsPerStage = Math.max(maximumFactsPerStage, facts)
      maximumWarningsPerStage = Math.max(maximumWarningsPerStage, stage.warnings.length)
      warningsTotal += stage.warnings.length
      warningFactsTotal += warningFacts
    }
  }

  const inputManifest = {
    scenario: SCENARIO,
    mode,
    variant: mode === 'base-variant' ? VARIANT : null,
    pattern: DEFAULT_WEEKLY_TRAINING_PATTERN,
    templates,
    generatorPipeline: [
      'generateWeeklySessionProposals',
      'groupSharedSessionEvents',
      'buildGenerationExplanation',
    ],
    approvedStageOrder: GENERATION_EXPLANATION_STAGE_ORDER,
  }
  const sourceManifest = {
    scenarioVersion: mode === 'base-variant' ? 'kan-789-annual-base-variant-pure-v1' : SCENARIO.scenarioVersion,
    inputSha256: sha256(JSON.stringify(inputManifest)),
    generatedFromPureInputs: true,
    originalCoachPreviewRecovered: false,
  }
  const envelope = { proposal, generationExplanations: explanations, sourceManifest }
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const thresholds = SESSION_GENERATION_SNAPSHOT_LIMITS
  const measured = {
    provenance: {
      kind: 'representative-deterministic-pure-generation',
      historicalAcceptance: false,
      gitSha: revision,
      scenarioVersion: SCENARIO.scenarioVersion,
      inputSha256: sourceManifest.inputSha256,
      proposalSha256: sha256(JSON.stringify(proposal)),
      explanationSha256: sha256(JSON.stringify(explanations)),
      envelopeSha256: sha256(JSON.stringify(envelope)),
      node: process.version,
      expectedPackageManager: 'pnpm@12.4.1',
    },
    cardinality: {
      weeks: byWeek.length,
      scopeCount: mode === 'base-variant' ? 2 : 1,
      planningScopeCount: runs.length,
      independentGenerationRuns: runs.length,
      sharedEventsWithMultiplePrescriptions: eventCounts.filter(count => count > 1).length,
      basePrescriptions: runs.filter(run => run.scope === 'base').reduce((count, run) => count + run.result.proposals.length, 0),
      variantPrescriptions: runs.filter(run => run.scope === 'variant').reduce((count, run) => count + run.result.proposals.length, 0),
      weekly: byWeek,
      sharedEvents: proposal.events.length,
      prescriptions,
      prescriptionsPerEvent: { min: Math.min(...eventCounts), max: Math.max(...eventCounts) },
      generatedProposals: byWeek.reduce((total, week) => total + week.proposals, 0),
      explanationCount: explanationValues.length,
      stagesPerExplanation: { min: Math.min(...stageCounts), max: Math.max(...stageCounts) },
      maximumFactsPerStage, maximumWarningsPerStage, warningsTotal, warningFactsTotal,
      perStage: factTotalsByStage,
      proposalWarnings: proposal.warnings.length,
    },
    utf8Bytes: {
      proposal: bytes(proposal), explanations: bytes(explanations),
      sourceManifest: bytes(sourceManifest), envelope: bytes(envelope),
      maximumIndividualExplanation: Math.max(...individualExplanationBytes),
    },
    limits: {
      maxBytes: thresholds.maxBytes,
      maxSessions: thresholds.maxSessions,
      maxPrescriptions: thresholds.maxPrescriptions,
      maxMicrocycles: thresholds.maxMicrocycles,
      maxFactsPerExplanationStage: thresholds.maxFactsPerExplanationStage,
      maxExplanationStages: thresholds.maxExplanationStages,
    },
    againstLimits: {
      bytes: bytes(envelope) <= thresholds.maxBytes,
      sessions: proposal.events.length <= thresholds.maxSessions,
      prescriptions: prescriptions <= thresholds.maxPrescriptions,
      microcycles: byWeek.length <= thresholds.maxMicrocycles,
      explanationStages: Math.max(...stageCounts) <= thresholds.maxExplanationStages,
      factsPerStage: maximumFactsPerStage <= thresholds.maxFactsPerExplanationStage,
    },
    caveat: 'Representative synthetic Base/Variant derivation (no persisted hierarchy), not the original Coach 239-session preview; never claim historical equivalence.',
  }
  console.log(JSON.stringify(measured, null, 2))
}

measure()
