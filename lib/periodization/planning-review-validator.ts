import { validateIntensityFeasibility } from '@/lib/periodization/intensity-feasibility-validator'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'
import type {
  IntegralPlanningReview,
  IntegralPlanningReviewValidation,
  PlanningReviewIssue,
  PlanningReviewIssueCode,
  PlanningReviewIssueReference,
} from '@/types/training/planning-review.types'

type IssueSource = PlanningReviewIssue['sourceBoundary']
type EntityType = PlanningReviewIssueReference['entityType']

function issue(
  code: PlanningReviewIssueCode,
  sourceBoundary: IssueSource,
  message: string,
  references: readonly PlanningReviewIssueReference[],
  severity: PlanningReviewIssue['severity'] = 'conflict',
): PlanningReviewIssue {
  return { code, severity, sourceBoundary, message, references }
}

function reference(
  entityType: EntityType,
  entityId: string,
  field?: string,
): PlanningReviewIssueReference {
  return { entityType, entityId, ...(field ? { field } : {}) }
}

function hasValidDateRange(startDate: string, endDate: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
    && startDate <= endDate
}

function isInsideRange(
  startDate: string,
  endDate: string,
  parentStartDate: string,
  parentEndDate: string,
) {
  return startDate >= parentStartDate && endDate <= parentEndDate
}

function targetEquals(first: number | null | undefined, second: number | null | undefined) {
  return (first ?? null) === (second ?? null)
}

function validTarget(value: number | null) {
  return value === null || (Number.isFinite(value) && value >= 0)
}

function planKind(review: IntegralPlanningReview) {
  const { planningCohortId, sourceGroupTrainingPlanId } = review.plan
  if (planningCohortId === null && sourceGroupTrainingPlanId === null) return 'group_base'
  if (planningCohortId !== null && sourceGroupTrainingPlanId !== null) return 'cohort_variant'
  return null
}

function pushDuplicateIssue(
  issues: PlanningReviewIssue[],
  seen: Set<string>,
  entityType: EntityType,
  entityId: string,
) {
  const key = `${entityType}:${entityId}`
  if (!seen.has(key)) {
    seen.add(key)
    return
  }

  issues.push(issue(
    'duplicate_entity_id',
    'persistence',
    `La revisión contiene más de un registro ${entityType} con ID ${entityId}.`,
    [reference(entityType, entityId)],
  ))
}

function validateScope(review: IntegralPlanningReview, issues: PlanningReviewIssue[]) {
  if (review.scope.groupTrainingPlanId !== review.plan.id) {
    issues.push(issue(
      'scope_plan_id_mismatch',
      'cohort_resolution',
      'El alcance de revisión no identifica el plan representado.',
      [reference('plan', review.plan.id, 'id')],
    ))
  }
  if (review.scope.groupId !== review.plan.groupId) {
    issues.push(issue(
      'scope_group_id_mismatch',
      'cohort_resolution',
      'El grupo del alcance no coincide con el grupo propietario del plan.',
      [reference('plan', review.plan.id, 'groupId')],
    ))
  }

  const actualKind = planKind(review)
  if (actualKind === null || actualKind !== review.scope.kind) {
    issues.push(issue(
      'scope_plan_kind_mismatch',
      'cohort_resolution',
      'La clase base/variante del alcance no coincide con la asociación del plan.',
      [reference('plan', review.plan.id, 'kind')],
    ))
  }
  if (
    review.scope.planningCohortId !== review.plan.planningCohortId
    || review.scope.sourceGroupTrainingPlanId !== review.plan.sourceGroupTrainingPlanId
  ) {
    issues.push(issue(
      'scope_cohort_lineage_mismatch',
      'cohort_resolution',
      'La procedencia de cohorte o plan base no coincide con el plan revisado.',
      [reference('plan', review.plan.id, 'sourceGroupTrainingPlanId')],
    ))
  }
  if (
    review.loadStrategy !== null
    && review.loadStrategy.groupTrainingPlanId !== review.plan.id
  ) {
    issues.push(issue(
      'load_strategy_plan_mismatch',
      'planning',
      'La estrategia de carga pertenece a otro plan.',
      [reference('plan', review.plan.id, 'loadStrategy')],
    ))
  }
  if (
    review.intensityStrategy !== null
    && review.intensityStrategy.groupTrainingPlanId !== review.plan.id
  ) {
    issues.push(issue(
      'intensity_strategy_plan_mismatch',
      'intensity',
      'La estrategia de intensidad pertenece a otro plan.',
      [reference('plan', review.plan.id, 'intensityStrategy')],
    ))
  }
}

function validateLoadStrategy(review: IntegralPlanningReview, issues: PlanningReviewIssue[]) {
  if (review.loadStrategy === null) return

  const validation = validateLoadStrategy(review.loadStrategy)
  for (const current of [...validation.errors, ...validation.warnings]) {
    issues.push(issue(
      'invalid_target_value',
      'planning',
      current.message,
      [reference('plan', review.plan.id, current.field)],
      current.severity === 'warning' ? 'warning' : 'conflict',
    ))
  }
}

function validateCompetition(
  review: IntegralPlanningReview,
  issues: PlanningReviewIssue[],
  seen: Set<string>,
) {
  const macrocycles = review.macrocycles.map(({ macrocycle }) => macrocycle)

  for (const competition of review.competitions) {
    const { entry, impactWindow } = competition
    pushDuplicateIssue(issues, seen, 'competition', entry.id)

    if (entry.groupTrainingPlanId !== review.plan.id) {
      issues.push(issue(
        'competition_plan_mismatch',
        'competition',
        'La competencia pertenece a otro plan.',
        [reference('competition', entry.id, 'groupTrainingPlanId')],
      ))
    }

    const insidePlanning = macrocycles.some((macrocycle) => (
      entry.date >= macrocycle.startDate && entry.date <= macrocycle.endDate
    ))
    if (!insidePlanning) {
      issues.push(issue(
        'competition_outside_planning_horizon',
        'competition',
        'La competencia queda fuera del horizonte de los macrociclos revisados.',
        [reference('competition', entry.id, 'date')],
        'warning',
      ))
    }

    if (impactWindow === null) continue
    pushDuplicateIssue(issues, seen, 'competition_window', impactWindow.competitionId)
    if (
      impactWindow.competitionId !== entry.id
      || impactWindow.competitionDate !== entry.date
      || impactWindow.priority !== entry.priority
      || impactWindow.race.startDate !== entry.date
      || impactWindow.race.endDate !== entry.date
      || impactWindow.startDate > impactWindow.endDate
    ) {
      issues.push(issue(
        'competition_window_mismatch',
        'competition',
        'La ventana competitiva no coincide con su competencia, prioridad o fecha.',
        [
          reference('competition', entry.id),
          reference('competition_window', impactWindow.competitionId),
        ],
      ))
    }
  }
}

function validateProtectedReferences(
  review: IntegralPlanningReview,
  issues: PlanningReviewIssue[],
  existingEntities: Set<string>,
) {
  for (const protectedValue of review.protectedValues) {
    const key = `${protectedValue.entityType}:${protectedValue.entityId}`
    if (existingEntities.has(key)) continue

    issues.push(issue(
      'protected_value_reference_missing',
      'persistence',
      'Un valor protegido referencia una entidad que no existe en la revisión.',
      [reference(
        protectedValue.entityType,
        protectedValue.entityId,
        protectedValue.field,
      )],
    ))
  }
}

function validateHierarchy(
  review: IntegralPlanningReview,
  issues: PlanningReviewIssue[],
  seen: Set<string>,
  existingEntities: Set<string>,
) {
  for (const macroNode of review.macrocycles) {
    const { macrocycle } = macroNode
    pushDuplicateIssue(issues, seen, 'macrocycle', macrocycle.id)
    existingEntities.add(`macrocycle:${macrocycle.id}`)

    if (macrocycle.groupTrainingPlanId !== review.plan.id) {
      issues.push(issue(
        'hierarchy_parent_mismatch',
        'planning',
        'El macrociclo pertenece a otro plan.',
        [reference('macrocycle', macrocycle.id, 'groupTrainingPlanId')],
      ))
    }
    if (!hasValidDateRange(macrocycle.startDate, macrocycle.endDate)) {
      issues.push(issue(
        'invalid_date_range',
        'planning',
        'El rango de fechas del macrociclo no es válido.',
        [reference('macrocycle', macrocycle.id, 'startDate')],
      ))
    }

    for (const mesoNode of macroNode.mesocycles) {
      const { mesocycle } = mesoNode
      pushDuplicateIssue(issues, seen, 'mesocycle', mesocycle.id)
      existingEntities.add(`mesocycle:${mesocycle.id}`)

      if (mesocycle.macrocycleId !== macrocycle.id) {
        issues.push(issue(
          'hierarchy_parent_mismatch',
          'planning',
          'El mesociclo referencia otro macrociclo.',
          [reference('mesocycle', mesocycle.id, 'macrocycleId')],
        ))
      }

      for (const microNode of mesoNode.microcycles) {
        const { microcycle, targets, intensityTarget } = microNode
        pushDuplicateIssue(issues, seen, 'microcycle', microcycle.id)
        existingEntities.add(`microcycle:${microcycle.id}`)

        if (microcycle.mesocycleId !== mesocycle.id) {
          issues.push(issue(
            'hierarchy_parent_mismatch',
            'planning',
            'El microciclo referencia otro mesociclo.',
            [reference('microcycle', microcycle.id, 'mesocycleId')],
          ))
        }
        if (!hasValidDateRange(microcycle.startDate, microcycle.endDate)) {
          issues.push(issue(
            'invalid_date_range',
            'planning',
            'El rango de fechas del microciclo no es válido.',
            [reference('microcycle', microcycle.id, 'startDate')],
          ))
        } else if (!isInsideRange(
          microcycle.startDate,
          microcycle.endDate,
          macrocycle.startDate,
          macrocycle.endDate,
        )) {
          issues.push(issue(
            'child_outside_parent_range',
            'planning',
            'El microciclo queda fuera del rango de su macrociclo.',
            [reference('microcycle', microcycle.id, 'startDate')],
          ))
        }
        if (
          !validTarget(targets.targetVolumeKm)
          || !validTarget(targets.targetElevationGainM)
          || !validTarget(targets.targetDurationMin)
        ) {
          issues.push(issue(
            'invalid_target_value',
            'planning',
            'Los objetivos semanales deben ser finitos, no negativos o nulos.',
            [reference('microcycle', microcycle.id, 'targets')],
          ))
        }
        if (
          !targetEquals(microcycle.targetVolumeKm, targets.targetVolumeKm)
          || microcycle.targetVolumeSource !== targets.targetVolumeSource
          || !targetEquals(microcycle.targetElevationGain, targets.targetElevationGainM)
          || microcycle.targetElevationSource !== targets.targetElevationSource
          || !targetEquals(microcycle.targetDurationMin, targets.targetDurationMin)
        ) {
          issues.push(issue(
            'microcycle_target_projection_mismatch',
            'planning',
            'La proyección de objetivos no coincide con el microciclo persistido.',
            [reference('microcycle', microcycle.id, 'targets')],
          ))
        }

        if (intensityTarget !== null) {
          if (intensityTarget.microcycleId !== microcycle.id) {
            issues.push(issue(
              'intensity_target_microcycle_mismatch',
              'intensity',
              'El objetivo de intensidad referencia otro microciclo.',
              [reference('microcycle', microcycle.id, 'intensityTarget')],
            ))
          }
          const feasibility = validateIntensityFeasibility({
            target: intensityTarget,
            sessionsPerWeek: microNode.sessions.length,
          })
          for (const message of feasibility.errors) {
            issues.push(issue(
              'intensity_target_infeasible',
              'intensity',
              message,
              [reference('microcycle', microcycle.id, 'intensityTarget')],
            ))
          }
        }

        validateSessions(review, microNode, issues, seen, existingEntities)
      }
    }
  }
}

function validateSessions(
  review: IntegralPlanningReview,
  microNode: IntegralPlanningReview['macrocycles'][number]['mesocycles'][number]['microcycles'][number],
  issues: PlanningReviewIssue[],
  seen: Set<string>,
  existingEntities: Set<string>,
) {
  const { microcycle } = microNode

  for (const sessionNode of microNode.sessions) {
    const { session, provenance } = sessionNode
    pushDuplicateIssue(issues, seen, 'session', session.id)
    existingEntities.add(`session:${session.id}`)

    if (session.teamId !== review.scope.teamId) {
      issues.push(issue(
        'session_team_mismatch',
        'session_generation',
        'La sesión pertenece a otro team.',
        [reference('session', session.id, 'teamId')],
      ))
    }
    if (session.date < microcycle.startDate || session.date > microcycle.endDate) {
      issues.push(issue(
        'session_outside_microcycle',
        'session_generation',
        'La sesión queda fuera del rango de su microciclo.',
        [reference('session', session.id, 'date')],
      ))
    }
    if (
      (provenance.ownership === 'manual' && provenance.sharedEventKey !== null)
      || (provenance.ownership !== 'manual' && !provenance.sharedEventKey.trim())
    ) {
      issues.push(issue(
        'invalid_generation_provenance',
        'session_generation',
        'La procedencia de la sesión no conserva una clave de generación válida.',
        [reference('session', session.id, 'provenance')],
      ))
    }

    for (const prescriptionNode of sessionNode.prescriptions) {
      const { prescription, provenance: prescriptionProvenance } = prescriptionNode
      pushDuplicateIssue(issues, seen, 'prescription', prescription.id)
      existingEntities.add(`prescription:${prescription.id}`)

      if (
        prescription.sessionId !== session.id
        || prescription.groupId !== review.scope.groupId
        || prescription.microcycleId !== microcycle.id
      ) {
        issues.push(issue(
          'prescription_reference_mismatch',
          'session_generation',
          'La prescripción no coincide con su sesión, grupo o microciclo.',
          [reference('prescription', prescription.id)],
        ))
      }
      if (
        (
          prescriptionProvenance.ownership === 'manual'
          && prescriptionProvenance.generationKey !== null
        )
        || (
          prescriptionProvenance.ownership !== 'manual'
          && !prescriptionProvenance.generationKey.trim()
        )
      ) {
        issues.push(issue(
          'invalid_generation_provenance',
          'session_generation',
          'La procedencia de la prescripción no conserva una clave de generación válida.',
          [reference('prescription', prescription.id, 'provenance')],
        ))
      }
    }
  }
}

/**
 * Validates one complete H11 review without mutating it or performing writes.
 *
 * Focused H6-H10 policies remain authoritative. This layer verifies that their
 * outputs compose into one referentially and temporally coherent aggregate.
 */
export function validateIntegralPlanningReview(
  review: IntegralPlanningReview,
): IntegralPlanningReviewValidation {
  const issues = [...review.issues]
  const seen = new Set<string>()
  const existingEntities = new Set<string>([`plan:${review.plan.id}`])

  validateScope(review, issues)
  validateLoadStrategy(review, issues)
  validateHierarchy(review, issues, seen, existingEntities)
  validateCompetition(review, issues, seen)
  validateProtectedReferences(review, issues, existingEntities)

  return {
    isValid: !issues.some(({ severity }) => severity === 'conflict'),
    issues,
  }
}
