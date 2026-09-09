import type { StoredSessionGenerationPreferences } from '@/lib/session-generation/generation-preferences-persistence'
import { validatePlanningCohortPlanAssociation } from '@/lib/planning-cohorts/plan-association'
import type {
  GroupTrainingPlan,
  IntensityStrategy,
  LoadStrategy,
  Macrocycle,
  Mesocycle,
  Microcycle,
  MicrocycleIntensityTarget,
  PlanningCohort,
} from '@/types'

/**
 * Persisted session-generation preferences required by planning derivation.
 *
 * The persistence serializer intentionally works only with preference values,
 * while derivation also needs the persisted identity and owning plan so the
 * copied preference can receive an independent identity.
 */
export interface PlanningVariantSessionGenerationPreferences extends StoredSessionGenerationPreferences {
  id: string
  groupTrainingPlanId: string
}

/**
 * Complete planning aggregate required to derive a cohort variant.
 *
 * Session and GroupSessionPrescription records are deliberately absent. They
 * belong to the H6 session-generation lifecycle and must be generated or
 * reconciled separately after the planning variant exists.
 */
export interface PlanningVariantSource {
  plan: GroupTrainingPlan
  loadStrategy: LoadStrategy | null
  intensityStrategy: IntensityStrategy | null
  sessionGenerationPreferences: PlanningVariantSessionGenerationPreferences | null
  microcycleIntensityTargets: MicrocycleIntensityTarget[]
}

/**
 * Maps persisted identities created while deriving a planning variant.
 *
 * The maps make parent/child remapping explicit and provide a stable boundary
 * for later persistence without exposing mutable source entities.
 */
export interface PlanningVariantIdentityMap {
  planId: string
  loadStrategyId: string | null
  intensityStrategyId: string | null
  sessionGenerationPreferencesId: string | null
  macrocycleIds: Record<string, string>
  mesocycleIds: Record<string, string>
  microcycleIds: Record<string, string>
  intensityTargetIds: Record<string, string>
}

/**
 * Independent planning snapshot produced for one PlanningCohort.
 *
 * The source base plan remains available only through
 * `sourceGroupTrainingPlanId`. No copied planning entity shares mutable state
 * or persisted identity with its source.
 */
export interface DerivedPlanningVariant {
  plan: GroupTrainingPlan
  loadStrategy: LoadStrategy | null
  intensityStrategy: IntensityStrategy | null
  sessionGenerationPreferences: PlanningVariantSessionGenerationPreferences | null
  microcycleIntensityTargets: MicrocycleIntensityTarget[]
  identityMap: PlanningVariantIdentityMap
}

/**
 * Inputs required to derive an independent cohort planning variant.
 *
 * `createId` is injected so the derivation has no persistence dependency and
 * can use deterministic identities in focused tests.
 */
export interface DerivePlanningCohortVariantInput {
  source: PlanningVariantSource
  cohort: PlanningCohort
  title: string
  createId: () => string
}

export interface PlanningVariantDerivationIssue {
  code: string
  message: string
}

/**
 * Domain error raised when a safe planning snapshot cannot be derived.
 *
 * Issues use stable codes so callers and tests do not need to depend on
 * localized human-readable messages.
 */
export class PlanningVariantDerivationError extends Error {
  readonly issues: PlanningVariantDerivationIssue[]

  constructor(issues: PlanningVariantDerivationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '))
    this.name = 'PlanningVariantDerivationError'
    this.issues = issues
  }
}

function derivationIssue(code: string, message: string): PlanningVariantDerivationIssue {
  return { code, message }
}

/**
 * Collects every persisted identity that belongs to the source snapshot.
 *
 * New identities are checked against this set so derivation cannot
 * accidentally reuse an ID from the base planning aggregate.
 */
function collectSourceIds(source: PlanningVariantSource): Set<string> {
  const ids = new Set<string>()

  ids.add(source.plan.id)

  if (source.loadStrategy) {
    ids.add(source.loadStrategy.id)
  }

  if (source.intensityStrategy) {
    ids.add(source.intensityStrategy.id)
  }

  if (source.sessionGenerationPreferences) {
    ids.add(source.sessionGenerationPreferences.id)
  }

  for (const macrocycle of source.plan.macrocycles ?? []) {
    ids.add(macrocycle.id)

    for (const mesocycle of macrocycle.mesocycles ?? []) {
      ids.add(mesocycle.id)

      for (const microcycle of mesocycle.microcycles ?? []) {
        ids.add(microcycle.id)
      }
    }
  }

  for (const intensityTarget of source.microcycleIntensityTargets) {
    ids.add(intensityTarget.id)
  }

  return ids
}

/**
 * Creates one identity that is both new relative to the source aggregate and
 * unique inside the derived aggregate.
 */
function createDerivedId(createId: () => string, sourceIds: Set<string>, derivedIds: Set<string>): string {
  const id = createId()

  if (sourceIds.has(id)) {
    throw new PlanningVariantDerivationError([
      derivationIssue('derived-id-reuses-source-id', `La identidad derivada "${id}" ya pertenece al plan base.`),
    ])
  }

  if (derivedIds.has(id)) {
    throw new PlanningVariantDerivationError([
      derivationIssue('duplicate-derived-id', `La identidad derivada "${id}" fue generada más de una vez.`),
    ])
  }

  derivedIds.add(id)
  return id
}

function cloneMicrocycle(source: Microcycle, mesocycleId: string, id: string): Microcycle {
  return {
    id,
    mesocycleId,
    weekNumber: source.weekNumber,
    type: source.type,
    loadFocus: source.loadFocus,
    startDate: source.startDate,
    endDate: source.endDate,
    targetVolumeKm: source.targetVolumeKm,
    targetVolumeSource: source.targetVolumeSource,
    targetElevationGain: source.targetElevationGain,
    targetElevationSource: source.targetElevationSource,
    targetDurationMin: source.targetDurationMin,
    notes: source.notes,

    // `sessions` is intentionally not copied. Materialized sessions remain
    // owned by the separate session-generation/regeneration lifecycle.
  }
}

function cloneMesocycle(
  source: Mesocycle,
  macrocycleId: string,
  id: string,
  cloneMicrocycles: () => Microcycle[] | undefined,
): Mesocycle {
  return {
    id,
    macrocycleId,
    title: source.title,
    number: source.number,
    period: source.period,
    objective: source.objective,
    microcycles: cloneMicrocycles(),
  }
}

function cloneMacrocycle(
  source: Macrocycle,
  groupTrainingPlanId: string,
  id: string,
  cloneMesocycles: () => Mesocycle[] | undefined,
): Macrocycle {
  return {
    id,
    groupTrainingPlanId,
    title: source.title,
    startDate: source.startDate,
    endDate: source.endDate,
    taperingWeeksCount: source.taperingWeeksCount,
    targetRaceName: source.targetRaceName,
    targetRaceDistanceKm: source.targetRaceDistanceKm,
    targetRaceElevationGain: source.targetRaceElevationGain,
    notes: source.notes,
    mesocycles: cloneMesocycles(),
  }
}

/**
 * Derives an independent planning snapshot for a cohort from a group base plan.
 *
 * The resulting GroupTrainingPlan:
 *
 * - belongs to the same sporting group as the base plan;
 * - targets exactly one active PlanningCohort;
 * - keeps the direct base plan as lineage through sourceGroupTrainingPlanId;
 * - always starts as `draft`, independently of the source plan status;
 * - receives new identities for every copied persisted planning entity;
 * - preserves manual/generated and suggested/manual provenance values;
 * - never shares mutable nested planning state with the source; and
 * - never copies Session or GroupSessionPrescription records.
 *
 * The operation performs no database writes. Persisting the returned snapshot
 * belongs to a later H7 task.
 */
export function derivePlanningCohortVariant(input: DerivePlanningCohortVariantInput): DerivedPlanningVariant {
  const { source, cohort, title, createId } = input

  const sourceValidation = validatePlanningCohortPlanAssociation({
    plan: source.plan,
    cohort: null,
    sourcePlan: null,
  })

  if (!sourceValidation.isValid || sourceValidation.kind !== 'group_base') {
    throw new PlanningVariantDerivationError([
      derivationIssue(
        'source-plan-not-base',
        'Solo un plan grupal base puede utilizarse para derivar una variante de cohorte.',
      ),
    ])
  }

  const sourceIds = collectSourceIds(source)
  const derivedIds = new Set<string>()

  const nextId = () => createDerivedId(createId, sourceIds, derivedIds)

  const variantPlanId = nextId()

  const variantPlan: GroupTrainingPlan = {
    id: variantPlanId,
    groupId: source.plan.groupId,
    planningCohortId: cohort.id,
    sourceGroupTrainingPlanId: source.plan.id,
    title,
    status: 'draft',
    notes: source.plan.notes,
  }

  const associationValidation = validatePlanningCohortPlanAssociation({
    plan: variantPlan,
    cohort,
    sourcePlan: source.plan,
  })

  if (!associationValidation.isValid) {
    throw new PlanningVariantDerivationError(
      associationValidation.errors.map((error) => ({
        code: error.code,
        message: error.message,
      })),
    )
  }

  const identityMap: PlanningVariantIdentityMap = {
    planId: variantPlanId,
    loadStrategyId: null,
    intensityStrategyId: null,
    sessionGenerationPreferencesId: null,
    macrocycleIds: {},
    mesocycleIds: {},
    microcycleIds: {},
    intensityTargetIds: {},
  }

  const loadStrategy = source.loadStrategy
    ? (() => {
        const id = nextId()
        identityMap.loadStrategyId = id

        return {
          id,
          groupTrainingPlanId: variantPlanId,
          context: { ...source.loadStrategy.context },
          values: { ...source.loadStrategy.values },
          fieldSources: { ...source.loadStrategy.fieldSources },
        } satisfies LoadStrategy
      })()
    : null

  const intensityStrategy = source.intensityStrategy
    ? (() => {
        const id = nextId()
        identityMap.intensityStrategyId = id

        return {
          id,
          groupTrainingPlanId: variantPlanId,
          context: { ...source.intensityStrategy.context },
          values: { ...source.intensityStrategy.values },
          fieldSources: { ...source.intensityStrategy.fieldSources },
        } satisfies IntensityStrategy
      })()
    : null

  const sessionGenerationPreferences = source.sessionGenerationPreferences
    ? (() => {
        const id = nextId()
        identityMap.sessionGenerationPreferencesId = id

        return {
          id,
          groupTrainingPlanId: variantPlanId,
          frequencyMode: source.sessionGenerationPreferences.frequencyMode,
          fixedSessionsPerWeek: source.sessionGenerationPreferences.fixedSessionsPerWeek,
          weeklyPattern: source.sessionGenerationPreferences.weeklyPattern.map((slot) => ({ ...slot })),
        } satisfies PlanningVariantSessionGenerationPreferences
      })()
    : null

  const macrocycles = source.plan.macrocycles?.map((sourceMacrocycle) => {
    const macrocycleId = nextId()
    identityMap.macrocycleIds[sourceMacrocycle.id] = macrocycleId

    return cloneMacrocycle(sourceMacrocycle, variantPlanId, macrocycleId, () =>
      sourceMacrocycle.mesocycles?.map((sourceMesocycle) => {
        const mesocycleId = nextId()
        identityMap.mesocycleIds[sourceMesocycle.id] = mesocycleId

        return cloneMesocycle(sourceMesocycle, macrocycleId, mesocycleId, () =>
          sourceMesocycle.microcycles?.map((sourceMicrocycle) => {
            const microcycleId = nextId()
            identityMap.microcycleIds[sourceMicrocycle.id] = microcycleId

            return cloneMicrocycle(sourceMicrocycle, mesocycleId, microcycleId)
          }),
        )
      }),
    )
  })

  variantPlan.macrocycles = macrocycles

  const microcycleIntensityTargets = source.microcycleIntensityTargets.map((sourceTarget) => {
    const microcycleId = identityMap.microcycleIds[sourceTarget.microcycleId]

    if (!microcycleId) {
      throw new PlanningVariantDerivationError([
        derivationIssue(
          'intensity-target-outside-source-plan',
          `El objetivo de intensidad "${sourceTarget.id}" referencia un microciclo que no pertenece al snapshot base.`,
        ),
      ])
    }

    const id = nextId()
    identityMap.intensityTargetIds[sourceTarget.id] = id

    return {
      id,
      microcycleId,
      emphasis: sourceTarget.emphasis,
      intenseSessionsTarget: sourceTarget.intenseSessionsTarget,
      predominantZone: sourceTarget.predominantZone,
      pamPercentageTarget: sourceTarget.pamPercentageTarget,
      minimumRecoveryDaysBetweenIntenseSessions: sourceTarget.minimumRecoveryDaysBetweenIntenseSessions,
      fieldSources: { ...sourceTarget.fieldSources },
    } satisfies MicrocycleIntensityTarget
  })

  return {
    plan: variantPlan,
    loadStrategy,
    intensityStrategy,
    sessionGenerationPreferences,
    microcycleIntensityTargets,
    identityMap,
  }
}
