import type { MicrocycleType } from '@/types/training/periodization.types'
import type {
  SessionGenerationIntensityTarget,
  TrainingWeekday,
  WeeklyLoadAllocation,
  WeeklyLoadBudget,
  WeeklySessionFrequency,
  WeeklySessionRole,
  WeeklyTrainingSlot,
} from '@/types/training/session-generation.types'

const MIN_AUTO_SESSIONS = 3
const MAX_AUTO_SESSIONS = 5

const WEEKDAY_INDEX: Record<TrainingWeekday, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

const SLOT_SELECTION_PRIORITY: Record<WeeklySessionRole, number> = {
  competition: 110,
  quality: 100,
  mountain: 90,
  base: 70,
  long: 60,
  recovery: 50,
}

const INTENSITY_PRIORITY: Record<WeeklySessionRole, number> = {
  competition: 110,
  quality: 100,
  mountain: 80,
  long: 60,
  base: 30,
  recovery: 0,
}

const DEFAULT_VOLUME_WEIGHT: Record<WeeklySessionRole, number> = {
  base: 1,
  mountain: 1.1,
  long: 1.2,
  quality: 0.8,
  recovery: 0.7,
  competition: 1.4,
}

const DEFAULT_ELEVATION_WEIGHT: Record<WeeklySessionRole, number> = {
  base: 0.2,
  mountain: 1.4,
  long: 0.6,
  quality: 0.2,
  recovery: 0.1,
  competition: 1,
}

export interface ResolveWeeklySessionCountInput {
  frequency: WeeklySessionFrequency
  microcycleType: MicrocycleType
  targetVolumeKm: number
  maximumWeeklyVolumeKm: number
  /**
   * True only when the race itself falls inside this microcycle. The race
   * counts as one generated weekly session, not as an extra event.
   */
  includesRace?: boolean
}

/**
 * Resolves 3-5 weekly sessions for AUTO mode.
 *
 * Deload is intentionally conservative. Tapering may keep four sessions when
 * there is still meaningful weekly load, while a race microcycle that actually
 * contains the race resolves to three total sessions including the race.
 */
export function resolveWeeklySessionCount(input: ResolveWeeklySessionCountInput) {
  if (input.frequency.mode === 'fixed') {
    if (
      !Number.isInteger(input.frequency.sessionsPerWeek) ||
      input.frequency.sessionsPerWeek < MIN_AUTO_SESSIONS ||
      input.frequency.sessionsPerWeek > MAX_AUTO_SESSIONS
    ) {
      throw new RangeError('Fixed weekly session count must be an integer between 3 and 5')
    }

    return input.frequency.sessionsPerWeek
  }

  const relativeLoad =
    input.maximumWeeklyVolumeKm > 0
      ? input.targetVolumeKm / input.maximumWeeklyVolumeKm
      : 0

  if (input.microcycleType === 'deload') return 3

  if (input.microcycleType === 'tapering') {
    return relativeLoad > 0.55 ? 4 : 3
  }

  if (input.microcycleType === 'race') {
    if (input.includesRace) return 3
    return relativeLoad > 0.55 ? 4 : 3
  }

  if (input.microcycleType === 'shock') {
    return relativeLoad < 0.55 ? 4 : 5
  }

  if (relativeLoad < 0.55) return 3
  if (relativeLoad > 0.8) return 5
  return 4
}

/**
 * Chooses the habitual slots that survive when AUTO/FIXED frequency is below
 * the full pattern. The returned slots are always restored to weekday order.
 *
 * Weekend long/mountain slots receive a bonus so a five-day Mon/Tue/Wed/Thu/Sat
 * pattern naturally resolves to Tue/Thu/Sat for 3 sessions and adds Mon for 4.
 */
export function selectWeeklySlots(slots: WeeklyTrainingSlot[], sessionCount: number) {
  if (sessionCount < 1) return []
  if (sessionCount >= slots.length) return [...slots].sort(compareByWeekday)

  return [...slots]
    .sort((a, b) => getSlotSelectionScore(b) - getSlotSelectionScore(a) || compareByWeekday(b, a))
    .slice(0, sessionCount)
    .sort(compareByWeekday)
}

export function getVolumeWeight(slot: WeeklyTrainingSlot) {
  return positiveWeight(slot.volumeWeight, DEFAULT_VOLUME_WEIGHT[slot.role])
}

export function getElevationWeight(slot: WeeklyTrainingSlot) {
  const weekendMountainBonus =
    (slot.weekday === 'saturday' || slot.weekday === 'sunday') &&
    (slot.role === 'long' || slot.role === 'mountain')
      ? 1.4
      : 1

  return positiveWeight(
    slot.elevationWeight,
    DEFAULT_ELEVATION_WEIGHT[slot.role] * weekendMountainBonus,
  )
}

/**
 * Calculates how much of the microcycle budget is already consumed. Negative
 * remaining values are intentionally preserved so the UI can show the overage.
 */
export function calculateWeeklyLoadBudget(
  targetVolumeKm: number,
  targetElevationGain: number | null,
  allocations: WeeklyLoadAllocation[],
): WeeklyLoadBudget {
  const allocatedVolumeKm = roundTo(
    allocations.reduce((sum, allocation) => sum + allocation.distanceKm, 0),
    2,
  )
  const allocatedElevationGain = Math.round(
    allocations.reduce((sum, allocation) => sum + allocation.elevationGain, 0),
  )

  return {
    targetVolumeKm,
    targetElevationGain,
    allocatedVolumeKm,
    allocatedElevationGain,
    remainingVolumeKm: roundTo(targetVolumeKm - allocatedVolumeKm, 2),
    remainingElevationGain:
      targetElevationGain === null ? null : targetElevationGain - allocatedElevationGain,
    volumeUsageRatio: targetVolumeKm > 0 ? allocatedVolumeKm / targetVolumeKm : 0,
    elevationUsageRatio:
      targetElevationGain !== null && targetElevationGain > 0
        ? allocatedElevationGain / targetElevationGain
        : null,
    isVolumeExceeded: allocatedVolumeKm > targetVolumeKm,
    isElevationExceeded:
      targetElevationGain !== null && allocatedElevationGain > targetElevationGain,
  }
}

/**
 * Allocates the remaining weekly distance and D+ after fixed geographical loads
 * have been consumed. Flexible sessions absorb the rest according to their
 * independent distance/elevation weights.
 */
export function distributeWeeklyLoad(
  slots: WeeklyTrainingSlot[],
  targetVolumeKm: number,
  targetElevationGain: number | null,
  fixedAllocations: WeeklyLoadAllocation[] = [],
): WeeklyLoadAllocation[] {
  const fixedBySlot = new Map(fixedAllocations.map((allocation) => [allocation.slotKey, allocation]))
  const result: WeeklyLoadAllocation[] = []
  const flexibleSlots: WeeklyTrainingSlot[] = []

  for (const slot of slots) {
    const fixed = fixedBySlot.get(slot.key)
    if (fixed) {
      result.push({ ...fixed, flexibility: 'fixed' })
    } else {
      flexibleSlots.push(slot)
    }
  }

  const fixedBudget = calculateWeeklyLoadBudget(targetVolumeKm, targetElevationGain, result)
  const remainingKm = Math.max(0, fixedBudget.remainingVolumeKm)
  const remainingElevation = Math.max(0, fixedBudget.remainingElevationGain ?? 0)

  const distances = distributeByWeight(flexibleSlots, remainingKm, getVolumeWeight, 1)
  const elevations = distributeByWeight(flexibleSlots, remainingElevation, getElevationWeight, 0)

  for (const slot of flexibleSlots) {
    result.push({
      slotKey: slot.key,
      flexibility: 'flexible',
      distanceKm: distances.get(slot.key) ?? 0,
      elevationGain: targetElevationGain === null ? 0 : elevations.get(slot.key) ?? 0,
    })
  }

  return result.sort(
    (a, b) =>
      WEEKDAY_INDEX[slots.find((slot) => slot.key === a.slotKey)?.weekday ?? 'monday'] -
      WEEKDAY_INDEX[slots.find((slot) => slot.key === b.slotKey)?.weekday ?? 'monday'],
  )
}

export interface DatedTrainingSlot {
  slot: WeeklyTrainingSlot
  date: string
}

/**
 * Chooses the highest-value combination of intense slots that satisfies the
 * required number of complete calendar recovery days between intense sessions.
 */
export function selectIntenseSlots(
  slots: DatedTrainingSlot[],
  intenseSessionsTarget: number,
  minimumRecoveryDays: number,
): DatedTrainingSlot[] {
  if (intenseSessionsTarget <= 0) return []

  const candidates = slots.filter(({ slot }) => INTENSITY_PRIORITY[slot.role] > 0)
  const desiredCount = Math.min(intenseSessionsTarget, candidates.length)
  let best: DatedTrainingSlot[] = []
  let bestScore = -Infinity

  for (const combination of combinations(candidates, desiredCount)) {
    if (!respectsRecovery(combination, minimumRecoveryDays)) continue

    const score = combination.reduce(
      (sum, candidate) => sum + INTENSITY_PRIORITY[candidate.slot.role],
      0,
    )

    if (score > bestScore) {
      best = combination
      bestScore = score
    }
  }

  return best.sort((a, b) => a.date.localeCompare(b.date))
}

/** PAM is a calendar preference only when the current intensity plan allows it. */
export function isPamPreferred(
  date: string,
  role: WeeklySessionRole,
  intensity: SessionGenerationIntensityTarget,
) {
  return (
    role === 'quality' &&
    intensity.defaultMethod === 'pam_percentage' &&
    intensity.intenseSessionsTarget > 0 &&
    intensity.pamPercentageTarget !== null &&
    intensity.emphasis !== 'recovery' &&
    isLastThursdayOfMonth(date)
  )
}

function getSlotSelectionScore(slot: WeeklyTrainingSlot) {
  const weekendLongBonus =
    (slot.weekday === 'saturday' || slot.weekday === 'sunday') &&
    (slot.role === 'long' || slot.role === 'mountain')
      ? 30
      : 0

  return SLOT_SELECTION_PRIORITY[slot.role] + weekendLongBonus
}

function compareByWeekday(a: WeeklyTrainingSlot, b: WeeklyTrainingSlot) {
  return WEEKDAY_INDEX[a.weekday] - WEEKDAY_INDEX[b.weekday]
}

function positiveWeight(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback
}

function distributeByWeight(
  slots: WeeklyTrainingSlot[],
  total: number,
  getWeight: (slot: WeeklyTrainingSlot) => number,
  decimals: number,
) {
  const values = new Map<string, number>()
  if (slots.length === 0) return values

  const totalWeight = slots.reduce((sum, slot) => sum + getWeight(slot), 0)
  let allocated = 0

  slots.forEach((slot, index) => {
    const isLast = index === slots.length - 1
    const value = isLast
      ? roundTo(total - allocated, decimals)
      : roundTo((total * getWeight(slot)) / totalWeight, decimals)

    values.set(slot.key, value)
    allocated = roundTo(allocated + value, decimals)
  })

  return values
}

function respectsRecovery(slots: DatedTrainingSlot[], minimumRecoveryDays: number) {
  const ordered = [...slots].sort((a, b) => a.date.localeCompare(b.date))

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = parseIsoDate(ordered[index - 1].date)
    const current = parseIsoDate(ordered[index].date)
    const differenceDays = Math.round((current.getTime() - previous.getTime()) / 86_400_000)
    const completeRecoveryDays = differenceDays - 1

    if (completeRecoveryDays < minimumRecoveryDays) return false
  }

  return true
}

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]]
  if (items.length < count) return []

  const [first, ...rest] = items
  return [
    ...combinations(rest, count - 1).map((combination) => [first, ...combination]),
    ...combinations(rest, count),
  ]
}

function isLastThursdayOfMonth(date: string) {
  const current = parseIsoDate(date)
  if (current.getUTCDay() !== 4) return false

  const nextThursday = new Date(current)
  nextThursday.setUTCDate(nextThursday.getUTCDate() + 7)
  return nextThursday.getUTCMonth() !== current.getUTCMonth()
}

function parseIsoDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}
