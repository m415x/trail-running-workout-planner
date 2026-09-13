import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveAthleteIntegralPlanningOnDate } from '@/lib/planning-cohorts/integral-planning-resolution'
import {
  derivePlanningCohortVariant,
  type PlanningVariantSource,
} from '@/lib/planning-cohorts/plan-derivation'
import { buildCompetitionAdjustmentProposal } from '@/lib/periodization/competition-adjustment-proposal'
import { preserveProtectedCompetitionPlanning } from '@/lib/periodization/competition-adjustment-protection'
import { reconcileReviewedCompetitionAdjustment } from '@/lib/periodization/competition-adjustment-reconciliation'
import { reviewCompetitionAdjustmentProposal } from '@/lib/periodization/competition-adjustment-review'
import { buildFullCompetitionATaperProposal } from '@/lib/periodization/full-a-taper-proposal'
import { decidePostCompetitionRecovery } from '@/lib/periodization/post-competition-recovery-decision'
import { persistIntegralPlanningReconciliation } from '@/lib/periodization/planning-review-persistence'
import { reconcileAcceptedPlanningBlocks } from '@/lib/periodization/planning-review-reconciliation'
import type {
  CompetitionEntry,
  GroupTrainingPlan,
  PlanningCohort,
  PreCompetitionLoadContext,
  TaperIntensityReference,
} from '@/types'
import type {
  PlanningReviewAtomicAuditRecord,
  PlanningReviewTransactionPort,
  PersistedIntegralPlanningReconciliation,
} from '@/types/training/planning-review-persistence.types'
import type {
  IntegralPlanningReconciliation,
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'
import type { IntegralPlanningReview } from '@/types/training/planning-review.types'

const entityDates = {
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const cohort: PlanningCohort = {
  id: 'cohort-a',
  teamId: 'team-1',
  groupId: 'group-1',
  name: 'Objetivo A',
  purpose: 'Preparación competitiva compartida',
  description: null,
  status: 'active',
}

const baseCompetition: CompetitionEntry = {
  ...entityDates,
  id: 'competition-base-a',
  groupTrainingPlanId: 'plan-base',
  name: 'Trail A',
  date: '2026-09-13',
  distanceKm: 21,
  elevationGainM: 800,
  priority: 'A',
  status: 'confirmed',
}

function baseSource(): PlanningVariantSource {
  const plan: GroupTrainingPlan = {
    ...entityDates,
    id: 'plan-base',
    groupId: 'group-1',
    planningCohortId: null,
    sourceGroupTrainingPlanId: null,
    title: 'Plan base',
    status: 'active',
    macrocycles: [{
      ...entityDates,
      id: 'macro-base',
      groupTrainingPlanId: 'plan-base',
      title: 'Macro base',
      startDate: '2026-09-07',
      endDate: '2026-09-20',
      mesocycles: [{
        id: 'meso-base',
        macrocycleId: 'macro-base',
        title: 'Específico',
        number: 1,
        period: 'specific_preparatory',
        objective: 'Preparar competencia A',
        microcycles: [{
          ...entityDates,
          id: 'micro-base-1',
          mesocycleId: 'meso-base',
          weekNumber: 1,
          type: 'development',
          startDate: '2026-09-07',
          endDate: '2026-09-13',
          targetVolumeKm: 50,
          targetVolumeSource: 'generated',
          targetElevationGain: 1_500,
          targetElevationSource: 'generated',
        }, {
          ...entityDates,
          id: 'micro-base-2',
          mesocycleId: 'meso-base',
          weekNumber: 2,
          type: 'recovery',
          startDate: '2026-09-14',
          endDate: '2026-09-20',
          targetVolumeKm: 30,
          targetVolumeSource: 'generated',
          targetElevationGain: 700,
          targetElevationSource: 'generated',
        }],
      }],
    }],
  }

  return {
    plan,
    loadStrategy: null,
    intensityStrategy: null,
    sessionGenerationPreferences: null,
    microcycleIntensityTargets: [],
    competitionEntries: [baseCompetition],
  }
}

function deterministicIds() {
  let index = 0
  return () => {
    index += 1
    return `variant-${index}`
  }
}

const load: PreCompetitionLoadContext = {
  referenceWindowWeeks: 4,
  analyzedWeeks: 4,
  volume: {
    recentAverageKm: 50,
    achievedPeakVolumeKm: 56,
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
  emphasis: 'threshold',
  intenseSessionsTarget: 2,
  predominantZone: 'Z2',
  pamPercentageTarget: 92.5,
  minimumRecoveryDaysBetweenIntenseSessions: 2,
}

function reviewFromPlan(input: {
  plan: GroupTrainingPlan
  teamId: string
  competition: CompetitionEntry
  cohortId: string | null
  sourcePlanId: string | null
  impactWindow: IntegralPlanningReview['competitions'][number]['impactWindow']
  sessionTitle: string
}): IntegralPlanningReview {
  const macrocycle = input.plan.macrocycles![0]
  const mesocycle = macrocycle.mesocycles![0]

  return {
    scope: {
      teamId: input.teamId,
      groupId: input.plan.groupId,
      groupTrainingPlanId: input.plan.id,
      kind: input.cohortId === null ? 'group_base' : 'cohort_variant',
      planningCohortId: input.cohortId,
      sourceGroupTrainingPlanId: input.sourcePlanId,
    },
    plan: {
      ...entityDates,
      ...input.plan,
      macrocycles: undefined,
    },
    loadStrategy: null,
    intensityStrategy: null,
    macrocycles: [{
      macrocycle: {
        ...entityDates,
        ...macrocycle,
        mesocycles: undefined,
      },
      mesocycles: [{
        mesocycle: {
          ...entityDates,
          ...mesocycle,
          microcycles: undefined,
        },
        microcycles: mesocycle.microcycles!.map((microcycle) => ({
          microcycle: {
            ...entityDates,
            ...microcycle,
            sessions: undefined,
          },
          targets: {
            targetVolumeKm: microcycle.targetVolumeKm ?? null,
            targetVolumeSource: microcycle.targetVolumeSource,
            targetElevationGainM: microcycle.targetElevationGain ?? null,
            targetElevationSource: microcycle.targetElevationSource,
            targetDurationMin: microcycle.targetDurationMin ?? null,
          },
          intensityTarget: null,
          competitiveAdjustmentValueSources: null,
          sessions: microcycle.weekNumber === 1 ? [{
            session: {
              ...entityDates,
              id: `session-${input.plan.id}`,
              teamId: input.teamId,
              date: '2026-09-09',
              title: input.sessionTitle,
              type: 'Trail',
            },
            provenance: {
              ownership: 'generated',
              sharedEventKey: `${input.plan.id}::${microcycle.id}::shared-wednesday`,
            },
            prescriptions: [{
              prescription: {
                ...entityDates,
                id: `prescription-${input.plan.id}`,
                sessionId: `session-${input.plan.id}`,
                groupId: input.plan.groupId,
                microcycleId: microcycle.id,
              },
              provenance: {
                ownership: 'generated',
                generationKey: `${input.plan.id}::${microcycle.id}::${input.plan.groupId}::wednesday`,
              },
            }],
          }] : [],
        })),
      }],
    }],
    competitions: [{
      entry: input.competition,
      impactWindow: input.impactWindow,
    }],
    protectedValues: [],
    issues: [],
  }
}

interface MemoryState {
  applied: string[]
  audits: PlanningReviewAtomicAuditRecord[]
  journal: Record<string, PersistedIntegralPlanningReconciliation>
}

class MemoryTransactionPort implements PlanningReviewTransactionPort<MemoryState> {
  state: MemoryState = { applied: [], audits: [], journal: {} }

  transaction<TResult>(work: (tx: MemoryState) => TResult): TResult {
    const snapshot = structuredClone(this.state)
    try {
      return work(this.state)
    } catch (error) {
      this.state = snapshot
      throw error
    }
  }

  findCommittedResult(tx: MemoryState, idempotencyKey: string) {
    return tx.journal[idempotencyKey] ?? null
  }

  applyOperation(tx: MemoryState, operation: PlanningReviewScopedOperation) {
    tx.applied.push(operation.identity)
  }

  appendAuditRecord(tx: MemoryState, record: PlanningReviewAtomicAuditRecord) {
    tx.audits.push(record)
  }

  markCommitted(
    tx: MemoryState,
    idempotencyKey: string,
    result: PersistedIntegralPlanningReconciliation,
  ) {
    tx.journal[idempotencyKey] = result
  }
}

function planningResolutionPlan(plan: GroupTrainingPlan) {
  return {
    id: plan.id,
    groupId: plan.groupId,
    planningCohortId: plan.planningCohortId,
    status: plan.status,
    isDeleted: false,
    macrocycles: plan.macrocycles!.map((macrocycle) => ({
      startDate: macrocycle.startDate,
      endDate: macrocycle.endDate,
      isDeleted: false,
    })),
  }
}

describe('flujo integral H11', () => {
  it('compone cohorte, competencia, review coach, regeneración, persistencia y resolución', () => {
    const source = baseSource()
    const sourceSnapshot = structuredClone(source)
    const derived = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante competitiva A',
      selectedCompetitionEntryIds: [baseCompetition.id],
      createId: deterministicIds(),
    })
    const variantPlan: GroupTrainingPlan = {
      ...derived.plan,
      status: 'active',
    }
    const variantCompetition = derived.competitionEntries[0]
    const variantMicrocycles = variantPlan.macrocycles![0].mesocycles![0].microcycles!

    assert.equal(variantPlan.sourceGroupTrainingPlanId, source.plan.id)
    assert.equal(variantPlan.planningCohortId, cohort.id)
    assert.notEqual(variantCompetition.id, baseCompetition.id)
    assert.equal(variantCompetition.groupTrainingPlanId, variantPlan.id)
    assert.deepEqual(source, sourceSnapshot)

    const taper = buildFullCompetitionATaperProposal({
      competition: {
        competitionId: variantCompetition.id,
        name: variantCompetition.name,
        date: variantCompetition.date,
        priority: 'A',
        distanceKm: variantCompetition.distanceKm,
        elevationGainM: variantCompetition.elevationGainM,
      },
      courseProfile: {
        distanceKm: variantCompetition.distanceKm,
        elevationGainM: variantCompetition.elevationGainM,
        source: 'manual',
      },
      preCompetitionLoad: load,
      intensityReference: intensity,
    })
    const recovery = decidePostCompetitionRecovery({
      priority: 'A',
      courseProfile: taper.demand.profile,
      competitionDemand: taper.demand,
    })
    const adjustment = buildCompetitionAdjustmentProposal({
      source: taper,
      recovery,
      existingMicrocycles: variantMicrocycles,
    })
    const protectedProposal = preserveProtectedCompetitionPlanning({
      proposal: adjustment,
      protectedState: [],
    })
    const raceWeek = protectedProposal.affectedMicrocycles.find(({ phases }) => phases.includes('race'))!
    const coachVolumeKm = Math.max(0, (raceWeek.proposed.targetVolumeKm ?? 20) - 1)
    const reviewed = reviewCompetitionAdjustmentProposal({
      proposal: protectedProposal,
      decision: 'adjusted',
      edits: [{
        microcycleId: raceWeek.microcycleId,
        targetVolumeKm: coachVolumeKm,
      }],
    })
    const competitiveWriteSet = reconcileReviewedCompetitionAdjustment({
      groupTrainingPlanId: variantPlan.id,
      reviewedProposal: reviewed,
      changedByUserId: 'coach-1',
    })
    const competitivePatch = competitiveWriteSet.patches.find(
      ({ microcycleId }) => microcycleId === raceWeek.microcycleId,
    )!

    assert.equal(competitivePatch.valueSources.targetVolumeKm, 'coach')
    assert.equal(competitivePatch.targetVolumeKm, coachVolumeKm)

    const current = reviewFromPlan({
      plan: variantPlan,
      teamId: 'team-1',
      competition: variantCompetition,
      cohortId: cohort.id,
      sourcePlanId: source.plan.id,
      impactWindow: adjustment.window,
      sessionTitle: 'Trail generado',
    })
    const proposed = structuredClone(current)
    const proposedWeek = proposed.macrocycles[0].mesocycles[0].microcycles.find(
      ({ microcycle }) => microcycle.id === competitivePatch.microcycleId,
    )!
    Object.assign(proposedWeek.microcycle, {
      type: competitivePatch.type,
      targetVolumeKm: competitivePatch.targetVolumeKm,
      targetElevationGain: competitivePatch.targetElevationGainM,
    })
    Object.assign(proposedWeek.targets, {
      targetVolumeKm: competitivePatch.targetVolumeKm,
      targetElevationGainM: competitivePatch.targetElevationGainM,
    })
    Object.assign(proposedWeek, {
      competitiveAdjustmentValueSources: competitivePatch.valueSources,
    })
    Object.assign(proposedWeek.sessions[0].session, {
      title: 'Trail regenerado y revisado',
    })

    const reconciliation: IntegralPlanningReconciliation = reconcileAcceptedPlanningBlocks({
      current,
      proposed,
      decisions: [{
        blockId: `macrocycle:macrocycle:generation:${variantPlan.id}:ordinal:1`,
        decision: 'accept',
        provenance: {
          source: 'coach',
          coachId: 'coach-1',
          decidedAt: '2026-09-12T21:30:00.000-03:00',
          reason: 'Acepto ajuste competitivo y regeneración local',
        },
      }],
    })

    assert.ok(reconciliation.operations.some(({ entity }) => entity.entityType === 'microcycle'))
    assert.ok(reconciliation.operations.some(({ entity }) => entity.entityType === 'session'))
    assert.equal(
      reconciliation.operations.every(({ scope }) => scope.groupTrainingPlanId === variantPlan.id),
      true,
    )

    const port = new MemoryTransactionPort()
    const committed = persistIntegralPlanningReconciliation({
      reconciliation,
      persistence: port,
    })
    const replayed = persistIntegralPlanningReconciliation({
      reconciliation: structuredClone(reconciliation),
      persistence: port,
    })

    assert.equal(committed.outcome, 'committed')
    assert.equal(replayed.outcome, 'already_committed')
    assert.equal(port.state.applied.length, reconciliation.operations.length)
    assert.equal(port.state.audits.length, reconciliation.operations.length)

    const baseReview = reviewFromPlan({
      plan: source.plan,
      teamId: 'team-1',
      competition: baseCompetition,
      cohortId: null,
      sourcePlanId: null,
      impactWindow: null,
      sessionTitle: 'Trail base',
    })
    const resolved = resolveAthleteIntegralPlanningOnDate({
      planning: {
        athleteTeamId: 'team-1',
        currentGroupId: 'group-1',
        groupChanges: [],
        memberships: [{
          id: 'membership-1',
          startDate: '2026-09-01',
          endDate: null,
          isDeleted: false,
          cohort: {
            id: cohort.id,
            teamId: cohort.teamId,
            groupId: cohort.groupId,
            status: cohort.status,
            isDeleted: false,
            planningVariant: planningResolutionPlan(variantPlan),
          },
        }],
        basePlans: [planningResolutionPlan(source.plan)],
        date: '2026-09-09',
      },
      reviews: [baseReview, proposed],
    })

    assert.equal(resolved.status, 'resolved')
    if (resolved.status !== 'resolved') return
    assert.equal(resolved.source, 'cohort')
    assert.equal(resolved.planId, variantPlan.id)
    assert.equal(resolved.review.plan.id, variantPlan.id)
    assert.equal(
      resolved.summary.competitions[0]?.entry.groupTrainingPlanId,
      variantPlan.id,
    )
  })
})
