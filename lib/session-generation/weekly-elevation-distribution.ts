import type {
  WeeklyElevationAllocation,
  WeeklyElevationDistribution,
  WeeklySessionRole,
  WeeklyTrainingSlot,
} from '@/types/training/session-generation.types'

const ELEVATION_STEP_METERS = 10

const DEFAULT_ELEVATION_WEIGHT: Record<WeeklySessionRole, number> = {
  base: 0.2,
  mountain: 1.4,
  long: 0.6,
  quality: 0.2,
  recovery: 0.1,
  competition: 1,
}

/** Returns the independent vertical weight for a weekly training slot. */
export function getElevationWeight(slot: WeeklyTrainingSlot) {
  const weekendMountainBonus =
    (slot.weekday === 'saturday' || slot.weekday === 'sunday') &&
    (slot.role === 'long' || slot.role === 'mountain')
      ? 1.4
      : 1
  const fallback = DEFAULT_ELEVATION_WEIGHT[slot.role] * weekendMountainBonus

  return slot.elevationWeight !== undefined &&
    Number.isFinite(slot.elevationWeight) &&
    slot.elevationWeight > 0
    ? slot.elevationWeight
    : fallback
}

/**
 * Distributes positive elevation after fixed geographical sessions consume
 * their real D+. Flexible allocations are rounded to practical ten-meter steps
 * and remain independent from the previously distributed distance.
 */
export function distributeWeeklyElevation(
  slots: WeeklyTrainingSlot[],
  targetElevationGain: number | null,
  fixedAllocations: WeeklyElevationAllocation[] = [],
): WeeklyElevationDistribution {
  assertValidTarget(targetElevationGain)
  assertValidSlots(slots)
  assertValidFixedAllocations(slots, fixedAllocations)

  const fixedBySlot = new Map(fixedAllocations.map((allocation) => [allocation.slotKey, allocation]))
  const fixedElevationGain = sumElevation(fixedAllocations)
  const flexibleSlots = slots.filter((slot) => !fixedBySlot.has(slot.key))
  const remainingForFlexible = targetElevationGain === null
    ? 0
    : Math.max(0, targetElevationGain - fixedElevationGain)
  const flexibleElevation = apportionElevation(flexibleSlots, remainingForFlexible)
  const allocations = slots.map((slot): WeeklyElevationAllocation => {
    const fixed = fixedBySlot.get(slot.key)
    if (fixed) return { ...fixed, flexibility: 'fixed' }

    return {
      slotKey: slot.key,
      flexibility: 'flexible',
      elevationGain: flexibleElevation.get(slot.key) ?? 0,
    }
  })
  const allocatedElevationGain = sumElevation(allocations)
  const remainingElevationGain = targetElevationGain === null
    ? null
    : targetElevationGain - allocatedElevationGain
  const warnings: string[] = []

  if (targetElevationGain === null && fixedElevationGain > 0) {
    warnings.push(
      `Las sesiones fijas incluyen ${fixedElevationGain} m D+ aunque el microciclo no tiene un objetivo de desnivel.`,
    )
  } else if (targetElevationGain !== null && fixedElevationGain > targetElevationGain) {
    warnings.push(
      `Las sesiones fijas superan el objetivo semanal por ${fixedElevationGain - targetElevationGain} m D+.`,
    )
  } else if (remainingForFlexible > 0 && flexibleSlots.length === 0) {
    warnings.push(
      `Quedan ${remainingForFlexible} m D+ sin asignar porque no hay sesiones flexibles.`,
    )
  }

  return {
    allocations,
    targetElevationGain,
    allocatedElevationGain,
    remainingElevationGain,
    isExceeded: targetElevationGain !== null && allocatedElevationGain > targetElevationGain,
    warnings,
  }
}

function apportionElevation(slots: WeeklyTrainingSlot[], totalMeters: number) {
  const allocation = new Map<string, number>()
  if (slots.length === 0) return allocation

  const totalWeight = slots.reduce((sum, slot) => sum + getElevationWeight(slot), 0)
  const totalSteps = Math.floor(totalMeters / ELEVATION_STEP_METERS)
  const exactShares = slots.map((slot) => {
    const exactSteps = (totalSteps * getElevationWeight(slot)) / totalWeight
    return {
      slot,
      steps: Math.floor(exactSteps),
      remainder: exactSteps - Math.floor(exactSteps),
    }
  })
  let stepsToAssign = totalSteps - exactShares.reduce((sum, share) => sum + share.steps, 0)
  const remainderOrder = [...exactShares].sort((left, right) => (
    right.remainder - left.remainder || left.slot.key.localeCompare(right.slot.key)
  ))

  for (const share of remainderOrder) {
    if (stepsToAssign <= 0) break
    share.steps += 1
    stepsToAssign -= 1
  }
  for (const share of exactShares) {
    allocation.set(share.slot.key, share.steps * ELEVATION_STEP_METERS)
  }

  const remainderMeters = totalMeters - totalSteps * ELEVATION_STEP_METERS
  if (remainderMeters > 0) {
    const highestPriority = remainderOrder[0]
    allocation.set(
      highestPriority.slot.key,
      (allocation.get(highestPriority.slot.key) ?? 0) + remainderMeters,
    )
  }

  return allocation
}

function assertValidTarget(targetElevationGain: number | null) {
  if (
    targetElevationGain !== null &&
    (!Number.isInteger(targetElevationGain) || targetElevationGain < 0)
  ) {
    throw new RangeError('Weekly elevation target must be a non-negative integer or null')
  }
}

function assertValidSlots(slots: WeeklyTrainingSlot[]) {
  const keys = new Set<string>()
  for (const slot of slots) {
    if (!slot.key || keys.has(slot.key)) {
      throw new RangeError(`Weekly elevation slots must have unique non-empty keys: ${slot.key}`)
    }
    keys.add(slot.key)
  }
}

function assertValidFixedAllocations(
  slots: WeeklyTrainingSlot[],
  fixedAllocations: WeeklyElevationAllocation[],
) {
  const slotKeys = new Set(slots.map((slot) => slot.key))
  const allocationKeys = new Set<string>()

  for (const allocation of fixedAllocations) {
    if (!slotKeys.has(allocation.slotKey)) {
      throw new RangeError(`Fixed elevation references an unknown slot: ${allocation.slotKey}`)
    }
    if (allocationKeys.has(allocation.slotKey)) {
      throw new RangeError(`Fixed elevation is duplicated for slot: ${allocation.slotKey}`)
    }
    if (
      allocation.flexibility !== 'fixed' ||
      !Number.isInteger(allocation.elevationGain) ||
      allocation.elevationGain < 0
    ) {
      throw new RangeError(`Invalid fixed elevation for slot: ${allocation.slotKey}`)
    }
    allocationKeys.add(allocation.slotKey)
  }
}

function sumElevation(allocations: WeeklyElevationAllocation[]) {
  return allocations.reduce((sum, allocation) => sum + allocation.elevationGain, 0)
}
