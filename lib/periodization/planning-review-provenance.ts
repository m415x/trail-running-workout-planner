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

function compareEntityId(
  first: { readonly entityId: string },
  second: { readonly entityId: string },
) {
  return first.entityId.localeCompare(second.entityId)
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
  const microcycles = review.macrocycles
    .flatMap(({ mesocycles }) => mesocycles)
    .flatMap(({ microcycles: nodes }) => nodes)
    .map((node) => ({
      entityId: node.microcycle.id,
      microcycleId: node.microcycle.id,
      targetSources: {
        targetVolumeSource: node.targets.targetVolumeSource,
        targetElevationSource: node.targets.targetElevationSource,
      },
      competitiveAdjustmentValueSources: node.competitiveAdjustmentValueSources,
      protectedValues: protectedValuesFor(protectedValues, node.microcycle.id),
    }))
    .sort(compareEntityId)
    .map(({ entityId: _entityId, ...provenance }) => provenance)
  const sessions = review.macrocycles
    .flatMap(({ mesocycles }) => mesocycles)
    .flatMap(({ microcycles: nodes }) => nodes)
    .flatMap(({ sessions: nodes }) => nodes)
    .map((node) => ({
      entityId: node.session.id,
      sessionId: node.session.id,
      provenance: node.provenance,
      replaceableByRegeneration: canRegenerationReplace(node.provenance.ownership),
      protectedValues: protectedValuesFor(protectedValues, node.session.id),
      prescriptions: node.prescriptions
        .map((prescription) => ({
          entityId: prescription.prescription.id,
          prescriptionId: prescription.prescription.id,
          provenance: prescription.provenance,
          replaceableByRegeneration: canRegenerationReplace(
            prescription.provenance.ownership,
          ),
          protectedValues: protectedValuesFor(
            protectedValues,
            prescription.prescription.id,
          ),
        }))
        .sort(compareEntityId)
        .map(({ entityId: _entityId, ...provenance }) => provenance),
    }))
    .sort(compareEntityId)
    .map(({ entityId: _entityId, ...provenance }) => provenance)

  return {
    plan: review.scope,
    microcycles,
    sessions,
    protectedValues,
  }
}
