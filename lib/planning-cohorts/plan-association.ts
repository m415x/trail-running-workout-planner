import type { GroupTrainingPlan, PlanningCohort } from '@/types'

type PlanAssociationFields = Pick<
  GroupTrainingPlan,
  'id' | 'groupId' | 'planningCohortId' | 'sourceGroupTrainingPlanId'
>

export interface PlanningCohortPlanAssociationIssue {
  code: string
  message: string
}

export interface PlanningCohortPlanAssociationValidation {
  isValid: boolean
  kind: 'group_base' | 'cohort_variant' | null
  errors: PlanningCohortPlanAssociationIssue[]
}

export interface ValidatePlanningCohortPlanAssociationInput {
  plan: PlanAssociationFields
  cohort: Pick<PlanningCohort, 'id' | 'groupId' | 'status'> | null
  sourcePlan: PlanAssociationFields | null
}

function associationIssue(code: string, message: string): PlanningCohortPlanAssociationIssue {
  return { code, message }
}

/**
 * Validates whether a plan is a group base or a cohort-owned variant.
 *
 * A variant must point directly to a base plan of the same sporting group.
 * Variant chains are intentionally forbidden so regeneration always has one
 * unambiguous baseline.
 */
export function validatePlanningCohortPlanAssociation(
  input: ValidatePlanningCohortPlanAssociationInput,
): PlanningCohortPlanAssociationValidation {
  const { cohort, plan, sourcePlan } = input
  const errors: PlanningCohortPlanAssociationIssue[] = []
  const isBase = plan.planningCohortId === null && plan.sourceGroupTrainingPlanId === null
  const isVariant = plan.planningCohortId !== null && plan.sourceGroupTrainingPlanId !== null

  if (!isBase && !isVariant) {
    errors.push(associationIssue(
      'incomplete-variant-association',
      'Una variante debe indicar tanto la cohorte como el plan base de origen.',
    ))
    return { isValid: false, kind: null, errors }
  }

  if (isBase) {
    if (cohort !== null || sourcePlan !== null) {
      errors.push(associationIssue(
        'base-plan-with-variant-context',
        'Un plan base no puede recibir contexto de cohorte ni de otro plan.',
      ))
    }

    return { isValid: errors.length === 0, kind: 'group_base', errors }
  }

  if (plan.id === plan.sourceGroupTrainingPlanId) {
    errors.push(associationIssue(
      'self-referenced-source-plan',
      'Una variante no puede utilizarse a sí misma como plan de origen.',
    ))
  }

  if (cohort === null || cohort.id !== plan.planningCohortId) {
    errors.push(associationIssue(
      'cohort-not-found',
      'La variante debe referenciar una cohorte existente.',
    ))
  } else {
    if (cohort.groupId !== plan.groupId) {
      errors.push(associationIssue(
        'cohort-group-mismatch',
        'La cohorte y su variante deben pertenecer al mismo grupo deportivo.',
      ))
    }

    if (cohort.status !== 'active') {
      errors.push(associationIssue(
        'cohort-archived',
        'No se puede asociar una nueva variante a una cohorte archivada.',
      ))
    }
  }

  if (sourcePlan === null || sourcePlan.id !== plan.sourceGroupTrainingPlanId) {
    errors.push(associationIssue(
      'source-plan-not-found',
      'La variante debe referenciar un plan base existente.',
    ))
  } else {
    if (sourcePlan.groupId !== plan.groupId) {
      errors.push(associationIssue(
        'source-plan-group-mismatch',
        'La variante y el plan base deben pertenecer al mismo grupo deportivo.',
      ))
    }

    if (sourcePlan.planningCohortId !== null || sourcePlan.sourceGroupTrainingPlanId !== null) {
      errors.push(associationIssue(
        'variant-source-not-base',
        'El origen de una variante debe ser un plan base, no otra variante.',
      ))
    }
  }

  return { isValid: errors.length === 0, kind: 'cohort_variant', errors }
}

