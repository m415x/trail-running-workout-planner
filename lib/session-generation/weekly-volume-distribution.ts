import type {
  WeeklySessionRole,
  WeeklyTrainingSlot,
  WeeklyVolumeAllocation,
  WeeklyVolumeDistribution,
} from '@/types/training/session-generation.types'

const DEFAULT_VOLUME_WEIGHT: Record<WeeklySessionRole, number> = {
  base: 1,
  mountain: 1.1,
  long: 1.2,
  quality: 0.8,
  recovery: 0.7,
  competition: 1.4,
}

/** Returns a valid explicit weight or the practical default for the slot role. */
export function getVolumeWeight(slot: WeeklyTrainingSlot) {
  return slot.volumeWeight !== undefined && Number.isFinite(slot.volumeWeight) && slot.volumeWeight > 0
    ? slot.volumeWeight
    : DEFAULT_VOLUME_WEIGHT[slot.role]
}

/**
 * Distributes a weekly distance target after consuming fixed session loads.
 *
 * Flexible loads are apportioned by role weight using whole practical
 * kilometers. The largest remainders receive the unassigned kilometers, which
 * avoids making the last day absorb every rounding difference. Fixed loads are
 * never reduced automatically; an excess is returned as a warning.
 */
export function distributeWeeklyVolume(
  slots: WeeklyTrainingSlot[],
  targetVolumeKm: number,
  fixedAllocations: WeeklyVolumeAllocation[] = [],
): WeeklyVolumeDistribution {
  assertValidTarget(targetVolumeKm)
  assertValidSlots(slots)
  assertValidFixedAllocations(slots, fixedAllocations)

  const fixedBySlot = new Map(fixedAllocations.map((allocation) => [allocation.slotKey, allocation]))
  const fixedVolumeKm = sumDistance(fixedAllocations)
  const remainingForFlexibleKm = Math.max(0, targetVolumeKm - fixedVolumeKm)
  const flexibleSlots = slots.filter((slot) => !fixedBySlot.has(slot.key))
  const flexibleDistances = apportionWholeKilometers(flexibleSlots, remainingForFlexibleKm)
  const allocations = slots.map((slot): WeeklyVolumeAllocation => {
    const fixed = fixedBySlot.get(slot.key)
    if (fixed) return { ...fixed, flexibility: 'fixed' }

    return {
      slotKey: slot.key,
      flexibility: 'flexible',
      distanceKm: flexibleDistances.get(slot.key) ?? 0,
    }
  })
  const allocatedVolumeKm = sumDistance(allocations)
  const remainingVolumeKm = targetVolumeKm - allocatedVolumeKm
  const warnings: string[] = []

  if (fixedVolumeKm > targetVolumeKm) {
    warnings.push(
      `Las sesiones fijas superan el objetivo semanal por ${formatKm(fixedVolumeKm - targetVolumeKm)} km.`,
    )
  } else if (remainingForFlexibleKm > 0 && flexibleSlots.length === 0) {
    warnings.push(
      `Quedan ${formatKm(remainingForFlexibleKm)} km sin asignar porque no hay sesiones flexibles.`,
    )
  }

  return {
    allocations,
    targetVolumeKm,
    allocatedVolumeKm,
    remainingVolumeKm,
    isExceeded: allocatedVolumeKm > targetVolumeKm,
    warnings,
  }
}

function apportionWholeKilometers(slots: WeeklyTrainingSlot[], totalKm: number) {
  const allocation = new Map<string, number>()
  if (slots.length === 0) return allocation

  const totalWeight = slots.reduce((sum, slot) => sum + getVolumeWeight(slot), 0)
  const exactShares = slots.map((slot) => {
    const exact = (totalKm * getVolumeWeight(slot)) / totalWeight
    return { slot, exact, whole: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  const wholeTarget = Math.floor(totalKm)
  let kilometersToAssign = wholeTarget - exactShares.reduce((sum, share) => sum + share.whole, 0)

  const remainderOrder = [...exactShares].sort((left, right) => (
    right.remainder - left.remainder || left.slot.key.localeCompare(right.slot.key)
  ))
  for (const share of remainderOrder) {
    if (kilometersToAssign <= 0) break
    share.whole += 1
    kilometersToAssign -= 1
  }

  for (const share of exactShares) allocation.set(share.slot.key, share.whole)

  const fractionalRemainder = roundTo(totalKm - wholeTarget, 2)
  if (fractionalRemainder > 0) {
    const highestPriority = remainderOrder[0]
    allocation.set(
      highestPriority.slot.key,
      roundTo((allocation.get(highestPriority.slot.key) ?? 0) + fractionalRemainder, 2),
    )
  }

  return allocation
}

function assertValidTarget(targetVolumeKm: number) {
  if (!Number.isFinite(targetVolumeKm) || targetVolumeKm < 0) {
    throw new RangeError('Weekly target volume must be a finite non-negative number')
  }
}

function assertValidSlots(slots: WeeklyTrainingSlot[]) {
  const keys = new Set<string>()
  for (const slot of slots) {
    if (!slot.key || keys.has(slot.key)) {
      throw new RangeError(`Weekly volume slots must have unique non-empty keys: ${slot.key}`)
    }
    keys.add(slot.key)
  }
}

function assertValidFixedAllocations(
  slots: WeeklyTrainingSlot[],
  fixedAllocations: WeeklyVolumeAllocation[],
) {
  const slotKeys = new Set(slots.map((slot) => slot.key))
  const allocationKeys = new Set<string>()

  for (const allocation of fixedAllocations) {
    if (!slotKeys.has(allocation.slotKey)) {
      throw new RangeError(`Fixed volume references an unknown slot: ${allocation.slotKey}`)
    }
    if (allocationKeys.has(allocation.slotKey)) {
      throw new RangeError(`Fixed volume is duplicated for slot: ${allocation.slotKey}`)
    }
    if (
      allocation.flexibility !== 'fixed' ||
      !Number.isFinite(allocation.distanceKm) ||
      allocation.distanceKm < 0
    ) {
      throw new RangeError(`Invalid fixed volume for slot: ${allocation.slotKey}`)
    }
    allocationKeys.add(allocation.slotKey)
  }
}

function sumDistance(allocations: WeeklyVolumeAllocation[]) {
  return roundTo(
    allocations.reduce((sum, allocation) => sum + allocation.distanceKm, 0),
    2,
  )
}

function formatKm(value: number) {
  return roundTo(value, 2).toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}
