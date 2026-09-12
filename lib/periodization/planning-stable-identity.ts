export function stablePlanIdentity(planId: string) {
  return `plan:id:${required(planId, 'planId')}`
}

export function stableMacrocycleIdentity(
  groupTrainingPlanId: string,
  ordinal: number,
) {
  return `macrocycle:generation:${required(groupTrainingPlanId, 'groupTrainingPlanId')}:ordinal:${positiveInteger(ordinal, 'ordinal')}`
}

export function stableMesocycleIdentity(
  macrocycleIdentity: string,
  number: number,
) {
  return `mesocycle:generation:${required(macrocycleIdentity, 'macrocycleIdentity')}:number:${positiveInteger(number, 'number')}`
}

export function stableMicrocycleIdentity(
  groupTrainingPlanId: string,
  weekNumber: number,
) {
  return `microcycle:generation:${required(groupTrainingPlanId, 'groupTrainingPlanId')}:week:${positiveInteger(weekNumber, 'weekNumber')}`
}

export function stableSessionIdentity(
  id: string,
  provenance: { readonly sharedEventKey: string | null },
) {
  return provenance.sharedEventKey === null
    ? `session:id:${required(id, 'sessionId')}`
    : `session:generation:${required(provenance.sharedEventKey, 'sharedEventKey')}`
}

export function stablePrescriptionIdentity(
  id: string,
  provenance: { readonly generationKey: string | null },
) {
  return provenance.generationKey === null
    ? `prescription:id:${required(id, 'prescriptionId')}`
    : `prescription:generation:${required(provenance.generationKey, 'generationKey')}`
}

function required(value: string, field: string) {
  const normalized = value.trim()
  if (!normalized) throw new RangeError(`${field} cannot be empty`)
  return normalized
}

function positiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${field} must be a positive integer`)
  }
  return value
}
