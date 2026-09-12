import { validateIntegralPlanningReview } from '@/lib/periodization/planning-review-validator'
import type {
  IntegralPlanningDiff,
  IntegralPlanningDiffCounts,
  IntegralPlanningDiffItem,
  IntegralPlanningFieldChange,
} from '@/types/training/planning-review-diff.types'
import type {
  IntegralPlanningReview,
  PlanningReviewIssueReference,
  PlanningReviewProtectedValue,
} from '@/types/training/planning-review.types'

type EntityType = PlanningReviewIssueReference['entityType']

interface ComparableEntity {
  readonly identity: string
  readonly entityType: EntityType
  readonly entityId: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly protectedFields: ReadonlySet<string>
  readonly protectWholeEntity: boolean
  readonly protectRemoval: boolean
}

const FIELD_ALIASES: Readonly<Record<string, string>> = {
  target_volume_km: 'targetVolumeKm',
  target_elevation_gain: 'targetElevationGainM',
  target_elevation_gain_m: 'targetElevationGainM',
  microcycle_type: 'type',
}

function normalizedField(field: string) {
  return FIELD_ALIASES[field] ?? field
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, current]) => [key, normalize(current)]),
    )
  }
  return value
}

function equal(first: unknown, second: unknown) {
  return JSON.stringify(normalize(first)) === JSON.stringify(normalize(second))
}

function stableSessionIdentity(
  id: string,
  provenance: { readonly sharedEventKey: string | null },
) {
  return provenance.sharedEventKey === null
    ? `session:id:${id}`
    : `session:generation:${provenance.sharedEventKey}`
}

function stablePrescriptionIdentity(
  id: string,
  provenance: { readonly generationKey: string | null },
) {
  return provenance.generationKey === null
    ? `prescription:id:${id}`
    : `prescription:generation:${provenance.generationKey}`
}

function protectedFieldsFor(
  values: readonly PlanningReviewProtectedValue[],
  entityId: string,
) {
  return new Set(
    values
      .filter((value) => value.entityId === entityId)
      .map(({ field }) => normalizedField(field)),
  )
}

function addEntity(
  entities: Map<string, ComparableEntity>,
  entity: ComparableEntity,
) {
  if (entities.has(entity.identity)) {
    throw new RangeError(`Duplicated integral diff identity: ${entity.identity}`)
  }
  entities.set(entity.identity, entity)
}

function flattenReview(review: IntegralPlanningReview) {
  const entities = new Map<string, ComparableEntity>()
  const annotations = review.protectedValues

  addEntity(entities, {
    identity: `plan:id:${review.plan.id}`,
    entityType: 'plan',
    entityId: review.plan.id,
    fields: {
      id: review.plan.id,
      groupId: review.plan.groupId,
      planningCohortId: review.plan.planningCohortId,
      sourceGroupTrainingPlanId: review.plan.sourceGroupTrainingPlanId,
      title: review.plan.title,
      status: review.plan.status,
      notes: review.plan.notes ?? null,
    },
    protectedFields: new Set(['id', 'groupId', 'planningCohortId', 'sourceGroupTrainingPlanId']),
    protectWholeEntity: false,
    protectRemoval: true,
  })

  for (const macroNode of review.macrocycles) {
    const { macrocycle } = macroNode
    addEntity(entities, {
      identity: `macrocycle:id:${macrocycle.id}`,
      entityType: 'macrocycle',
      entityId: macrocycle.id,
      fields: normalize(macrocycle) as Readonly<Record<string, unknown>>,
      protectedFields: new Set(['id', 'groupTrainingPlanId']),
      protectWholeEntity: false,
      protectRemoval: false,
    })

    for (const mesoNode of macroNode.mesocycles) {
      const { mesocycle } = mesoNode
      addEntity(entities, {
        identity: `mesocycle:id:${mesocycle.id}`,
        entityType: 'mesocycle',
        entityId: mesocycle.id,
        fields: normalize(mesocycle) as Readonly<Record<string, unknown>>,
        protectedFields: new Set(['id', 'macrocycleId']),
        protectWholeEntity: false,
        protectRemoval: false,
      })

      for (const microNode of mesoNode.microcycles) {
        const { microcycle, targets, intensityTarget } = microNode
        const protectedFields = protectedFieldsFor(annotations, microcycle.id)
        protectedFields.add('id')
        protectedFields.add('mesocycleId')
        if (targets.targetVolumeSource === 'manual') {
          protectedFields.add('targetVolumeKm')
          protectedFields.add('targetVolumeSource')
        }
        if (targets.targetElevationSource === 'manual') {
          protectedFields.add('targetElevationGainM')
          protectedFields.add('targetElevationSource')
        }
        const competitiveSources = microNode.competitiveAdjustmentValueSources
        if (competitiveSources?.type === 'coach') protectedFields.add('type')
        if (competitiveSources?.targetVolumeKm === 'coach') {
          protectedFields.add('targetVolumeKm')
        }
        if (competitiveSources?.targetElevationGainM === 'coach') {
          protectedFields.add('targetElevationGainM')
        }
        if (competitiveSources?.allowIntenseSessions === 'coach') {
          protectedFields.add('intensityTarget')
        }

        addEntity(entities, {
          identity: `microcycle:id:${microcycle.id}`,
          entityType: 'microcycle',
          entityId: microcycle.id,
          fields: {
            id: microcycle.id,
            mesocycleId: microcycle.mesocycleId,
            weekNumber: microcycle.weekNumber,
            type: microcycle.type,
            loadFocus: microcycle.loadFocus ?? null,
            startDate: microcycle.startDate,
            endDate: microcycle.endDate,
            targetVolumeKm: targets.targetVolumeKm,
            targetVolumeSource: targets.targetVolumeSource,
            targetElevationGainM: targets.targetElevationGainM,
            targetElevationSource: targets.targetElevationSource,
            targetDurationMin: targets.targetDurationMin,
            notes: microcycle.notes ?? null,
            intensityTarget,
            competitiveAdjustmentValueSources: competitiveSources,
          },
          protectedFields,
          protectWholeEntity: false,
          protectRemoval: protectedFields.size > 2,
        })

        for (const sessionNode of microNode.sessions) {
          const { session, provenance } = sessionNode
          addEntity(entities, {
            identity: stableSessionIdentity(session.id, provenance),
            entityType: 'session',
            entityId: session.id,
            fields: {
              ...normalize(session) as Readonly<Record<string, unknown>>,
              provenance: normalize(provenance),
            },
            protectedFields: protectedFieldsFor(annotations, session.id),
            protectWholeEntity: provenance.ownership !== 'generated',
            protectRemoval: provenance.ownership !== 'generated'
              || protectedFieldsFor(annotations, session.id).size > 0,
          })

          for (const prescriptionNode of sessionNode.prescriptions) {
            const { prescription, provenance: prescriptionProvenance } = prescriptionNode
            addEntity(entities, {
              identity: stablePrescriptionIdentity(
                prescription.id,
                prescriptionProvenance,
              ),
              entityType: 'prescription',
              entityId: prescription.id,
              fields: {
                ...normalize(prescription) as Readonly<Record<string, unknown>>,
                provenance: normalize(prescriptionProvenance),
              },
              protectedFields: protectedFieldsFor(annotations, prescription.id),
              protectWholeEntity: prescriptionProvenance.ownership !== 'generated',
              protectRemoval: prescriptionProvenance.ownership !== 'generated'
                || protectedFieldsFor(annotations, prescription.id).size > 0,
            })
          }
        }
      }
    }
  }

  for (const { entry, impactWindow } of review.competitions) {
    addEntity(entities, {
      identity: `competition:id:${entry.id}`,
      entityType: 'competition',
      entityId: entry.id,
      fields: {
        ...normalize(entry) as Readonly<Record<string, unknown>>,
        impactWindow: normalize(impactWindow),
      },
      protectedFields: new Set(['id', 'groupTrainingPlanId']),
      protectWholeEntity: false,
      protectRemoval: true,
    })
  }

  return entities
}

function changesBetween(
  current: ComparableEntity,
  proposed: ComparableEntity,
) {
  const fields = new Set([
    ...Object.keys(current.fields),
    ...Object.keys(proposed.fields),
  ])
  return [...fields]
    .sort()
    .flatMap((field): IntegralPlanningFieldChange[] => (
      equal(current.fields[field], proposed.fields[field])
        ? []
        : [{
            field,
            currentValue: current.fields[field],
            proposedValue: proposed.fields[field],
          }]
    ))
}

function classifyExisting(
  current: ComparableEntity,
  proposed: ComparableEntity | undefined,
): IntegralPlanningDiffItem {
  const entity = {
    entityType: current.entityType,
    entityId: current.entityId,
  }

  if (proposed === undefined) {
    const protectedEntity = current.protectRemoval
    return {
      identity: current.identity,
      entity,
      classification: protectedEntity ? 'preserved' : 'updated',
      operation: protectedEntity ? 'none' : 'remove',
      reason: protectedEntity ? 'protected_absence' : 'generated_change',
      changes: [{
        field: '$entity',
        currentValue: current.fields,
        proposedValue: null,
      }],
    }
  }

  const changes = changesBetween(current, proposed)
  if (changes.length === 0) {
    return {
      identity: current.identity,
      entity,
      classification: 'preserved',
      operation: 'none',
      reason: 'unchanged',
      changes: [],
    }
  }

  const protectedChange = current.protectWholeEntity
    || changes.some(({ field }) => current.protectedFields.has(field))

  return {
    identity: current.identity,
    entity,
    classification: protectedChange ? 'conflict' : 'updated',
    operation: protectedChange ? 'none' : 'update',
    reason: protectedChange ? 'protected_change' : 'generated_change',
    changes,
  }
}

function counts(items: readonly IntegralPlanningDiffItem[]): IntegralPlanningDiffCounts {
  const result: IntegralPlanningDiffCounts = {
    added: 0,
    updated: 0,
    preserved: 0,
    conflict: 0,
  }

  for (const item of items) result[item.classification] += 1
  return result
}

/**
 * Builds an inspectable H11 diff without accepting changes or writing data.
 *
 * Stable H6 generation keys match sessions and prescriptions across proposals.
 * Manual/coach/protected state is preserved or surfaced as conflict rather than
 * silently overwritten. KAN-231 owns block acceptance semantics.
 */
export function buildIntegralPlanningDiff(
  current: IntegralPlanningReview,
  proposed: IntegralPlanningReview,
): IntegralPlanningDiff {
  const currentEntities = flattenReview(current)
  const proposedEntities = flattenReview(proposed)
  const items: IntegralPlanningDiffItem[] = []

  for (const [identity, entity] of currentEntities) {
    items.push(classifyExisting(entity, proposedEntities.get(identity)))
  }

  for (const [identity, entity] of proposedEntities) {
    if (currentEntities.has(identity)) continue
    items.push({
      identity,
      entity: {
        entityType: entity.entityType,
        entityId: entity.entityId,
      },
      classification: 'added',
      operation: 'create',
      reason: 'new_entity',
      changes: [{
        field: '$entity',
        currentValue: null,
        proposedValue: entity.fields,
      }],
    })
  }

  items.sort((first, second) => first.identity.localeCompare(second.identity))
  const issues = [
    ...validateIntegralPlanningReview(current).issues,
    ...validateIntegralPlanningReview(proposed).issues,
  ]
  const diffCounts = counts(items)

  return {
    items,
    counts: diffCounts,
    issues,
    hasConflicts: diffCounts.conflict > 0
      || issues.some(({ severity }) => severity === 'conflict'),
  }
}
