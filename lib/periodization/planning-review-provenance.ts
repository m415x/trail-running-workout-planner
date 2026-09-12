import { canRegenerationReplace } from '@/lib/session-generation/generation-ownership'
import type {
  IntegralPlanningReview,
  IntegralPlanningReviewProvenance,
  PlanningReviewProtectedValue,
} from '@/types/training/planning-review.types'

function sortProtectedValues(
  values: readonly PlanningReviewProtectedValue[],
) {
  return [...values].sort((first, second) => (
    first.entityType.localeCompare(second.entityType)
    || first.entityId.localeCompare(second.entityId)
    || first.field.localeCompare(second.field)
    || first.sourceBoundary.localeCompare(second.sourceBoundary)
  ))
}

function protectedValuesFor(
  values: readonly PlanningReviewProtectedValue[],
  entityId: string,
) {
  return values.filter((value) => value.entityId === entityId)
}

function sortById<T>(
  values: readonly T[],
  getId: (value: T) => string,
) {
  return [...values].sort((first, second) => (
    getId(first).localeCompare(getId(second))
  ))
}

/**
 * Exposes H7 plan origin, H6 session ownership and H10 value provenance without
 * introducing a second source model.
 *
 * Replaceability is derived with the authoritative H6 ownership rule. Manual
 * planning sources and H10 coach sources remain unchanged, while protection
 * annotations point back to their existing owning boundary.
 */
export function buildIntegralPlanningReviewProvenance(
  review: IntegralPlanningReview,
): IntegralPlanningReviewProvenance {
  const protectedValues = sortProtectedValues(review.protectedValues)
  const microcycleNodes = review.macrocycles
    .flatMap(({ mesocycles }) => mesocycles)
    .flatMap(({ microcycles }) => microcycles)
  const microcycles = sortById(
    microcycleNodes,
    ({ microcycle }) => microcycle.id,
  ).map((node) => ({
    microcycleId: node.microcycle.id,
    targetSources: {
      targetVolumeSource: node.targets.targetVolumeSource,
      targetElevationSource: node.targets.targetElevationSource,
    },
    competitiveAdjustmentValueSources: node.competitiveAdjustmentValueSources,
    protectedValues: protectedValuesFor(protectedValues, node.microcycle.id),
  }))
  const sessionNodes = microcycleNodes.flatMap(({ sessions }) => sessions)
  const sessions = sortById(
    sessionNodes,
    ({ session }) => session.id,
  ).map((node) => ({
    sessionId: node.session.id,
    provenance: node.provenance,
    replaceableByRegeneration: canRegenerationReplace(node.provenance.ownership),
    protectedValues: protectedValuesFor(protectedValues, node.session.id),
    prescriptions: sortById(
      node.prescriptions,
      ({ prescription }) => prescription.id,
    ).map((prescription) => ({
      prescriptionId: prescription.prescription.id,
      provenance: prescription.provenance,
      replaceableByRegeneration: canRegenerationReplace(
        prescription.provenance.ownership,
      ),
      protectedValues: protectedValuesFor(
        protectedValues,
        prescription.prescription.id,
      ),
    })),
  }))

  return {
    plan: review.scope,
    microcycles,
    sessions,
    protectedValues,
  }
}
