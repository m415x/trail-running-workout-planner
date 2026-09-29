export interface PrescriptionPlanningScopeLineage {
  microcycleId: string
  groupTrainingPlanId: string
  groupId: string
  planningCohortId: string | null
}

export interface PrescriptionPlanningScope {
  microcycleId: string
  groupTrainingPlanId: string
  groupId: string
  planningCohortId: string | null
  source: 'base' | 'variant'
}

/**
 * Resolves the planning lineage owned by one session prescription.
 *
 * The persisted planning-scope identity remains the prescription's microcycle.
 * Base/Variant audience semantics are derived from the owning plan lineage and
 * are not persisted as a second audience authority here.
 */
export function resolvePrescriptionPlanningScope(input: {
  prescription: {
    groupId: string
    microcycleId: string
  }
  lineage: PrescriptionPlanningScopeLineage
}): PrescriptionPlanningScope {
  if (input.prescription.microcycleId !== input.lineage.microcycleId) {
    throw new Error('Prescription microcycle does not match planning lineage.')
  }

  if (input.prescription.groupId !== input.lineage.groupId) {
    throw new Error('Prescription group does not match planning lineage.')
  }

  return {
    microcycleId: input.lineage.microcycleId,
    groupTrainingPlanId: input.lineage.groupTrainingPlanId,
    groupId: input.lineage.groupId,
    planningCohortId: input.lineage.planningCohortId,
    source: input.lineage.planningCohortId === null ? 'base' : 'variant',
  }
}


/**
 * Ensures one prescription candidate per persisted planning scope inside a
 * shared Session. The persisted identity is the microcycle id; Base/Variant
 * semantics remain derived from planning lineage elsewhere.
 */
export function assertUniquePrescriptionPlanningScopes(
  prescriptions: Array<{ groupId: string; microcycleId: string }>,
): void {
  const seen = new Set<string>()

  for (const prescription of prescriptions) {
    if (seen.has(prescription.microcycleId)) {
      throw new Error(`Duplicate planning scope ${prescription.microcycleId} in shared Session.`)
    }
    seen.add(prescription.microcycleId)
  }
}
