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
import { createWeeklyTrainingSlot } from '@/lib/session-generation/default-weekly-pattern'
import { distributeWeeklyElevation } from '@/lib/session-generation/weekly-elevation-distribution'
import { distributeWeeklyVolume } from '@/lib/session-generation/weekly-volume-distribution'

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

const MICROTYPE_SLOT_PRIORITY: Record<MicrocycleType, Record<WeeklySessionRole, number>> = {
  base: { competition: 0, quality: 60, mountain: 75, base: 90, long: 95, recovery: 70 },
  development: SLOT_SELECTION_PRIORITY,
  shock: { competition: 0, quality: 100, mountain: 95, base: 65, long: 90, recovery: 40 },
  deload: { competition: 0, quality: 50, mountain: 55, base: 100, long: 75, recovery: 95 },
  tapering: { competition: 0, quality: 80, mountain: 40, base: 100, long: 70, recovery: 95 },
  race: { competition: 120, quality: 70, mountain: 20, base: 90, long: 30, recovery: 85 },
}

const FALLBACK_ROLE_BY_WEEKDAY: Record<TrainingWeekday, WeeklySessionRole> = {
  monday: 'base',
  tuesday: 'mountain',
  wednesday: 'long',
  thursday: 'quality',
  friday: 'recovery',
  saturday: 'long',
  sunday: 'recovery',
}

const INTENSITY_PRIORITY: Record<WeeklySessionRole, number> = {
  competition: 110,
  quality: 100,
  mountain: 80,
  long: 60,
  base: 30,
  recovery: 0,
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
 * Selects the best deterministic slot combination for one microcycle.
 *
 * Planning role priorities and recovery constraints take precedence over the
 * habitual pattern. Configured days receive a preference bonus, and missing
 * weekdays are considered only when the requested frequency cannot otherwise
 * be fulfilled. A race inside the week must occupy one of the selected slots.
 */
export interface WeeklySlotSelectionContext {
  microcycleType?: MicrocycleType
  includesRace?: boolean
  raceWeekday?: TrainingWeekday
  weekStartDate?: string
  intenseSessionsTarget?: number
  minimumRecoveryDays?: number
}

export function selectWeeklySlots(
  slots: WeeklyTrainingSlot[],
  sessionCount: number,
  context: WeeklySlotSelectionContext = {},
) {
  if (sessionCount < 1) return []
  if (!Number.isInteger(sessionCount) || sessionCount > 7) {
    throw new RangeError('Weekly slot count must be an integer between 1 and 7')
  }

  assertUniqueSlotWeekdays(slots)
  const candidates = completeSlotCandidates(slots, sessionCount, context)
  const desiredCount = Math.min(sessionCount, candidates.length)
  const possibleCombinations = combinations(candidates, desiredCount)
  const compatible = possibleCombinations.filter((combination) => (
    respectsSelectionConstraints(combination, context)
  ))
  const selectable = compatible.length > 0 ? compatible : possibleCombinations

  return selectable
    .sort((left, right) => (
      getCombinationScore(right, slots, context.microcycleType ?? 'development') -
        getCombinationScore(left, slots, context.microcycleType ?? 'development') ||
      compareCombinationOrder(left, right)
    ))[0]
    ?.sort(compareByWeekday) ?? []
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
  const volumeDistribution = distributeWeeklyVolume(
    slots,
    targetVolumeKm,
    fixedAllocations.map((allocation) => ({
      slotKey: allocation.slotKey,
      flexibility: 'fixed',
      distanceKm: allocation.distanceKm,
    })),
  )
  const volumeBySlot = new Map(
    volumeDistribution.allocations.map((allocation) => [allocation.slotKey, allocation.distanceKm]),
  )
  const elevationDistribution = distributeWeeklyElevation(
    slots,
    targetElevationGain,
    fixedAllocations.map((allocation) => ({
      slotKey: allocation.slotKey,
      flexibility: 'fixed',
      elevationGain: allocation.elevationGain,
    })),
  )
  const elevationBySlot = new Map(
    elevationDistribution.allocations.map((allocation) => [allocation.slotKey, allocation.elevationGain]),
  )

  for (const slot of slots) {
    const fixed = fixedBySlot.get(slot.key)
    if (fixed) {
      result.push({ ...fixed, flexibility: 'fixed' })
    } else {
      flexibleSlots.push(slot)
    }
  }

  for (const slot of flexibleSlots) {
    result.push({
      slotKey: slot.key,
      flexibility: 'flexible',
      distanceKm: volumeBySlot.get(slot.key) ?? 0,
      elevationGain: elevationBySlot.get(slot.key) ?? 0,
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

function getSlotSelectionScore(slot: WeeklyTrainingSlot, microcycleType: MicrocycleType) {
  const weekendLongBonus =
    microcycleType !== 'race' &&
    microcycleType !== 'tapering' &&
    (slot.weekday === 'saturday' || slot.weekday === 'sunday') &&
    (slot.role === 'long' || slot.role === 'mountain')
      ? 30
      : 0

  return MICROTYPE_SLOT_PRIORITY[microcycleType][slot.role] + weekendLongBonus
}

function completeSlotCandidates(
  slots: WeeklyTrainingSlot[],
  sessionCount: number,
  context: WeeklySlotSelectionContext,
) {
  const byWeekday = new Map(slots.map((slot) => [slot.weekday, { ...slot }]))

  if (context.includesRace) {
    if (!context.raceWeekday) {
      throw new RangeError('Race weekday is required when the microcycle includes a race')
    }
    const existing = byWeekday.get(context.raceWeekday)
    byWeekday.set(context.raceWeekday, {
      ...createWeeklyTrainingSlot(context.raceWeekday, 'competition'),
      key: existing?.key ?? `weekly-${context.raceWeekday}`,
    })
  }

  if (byWeekday.size < sessionCount) {
    for (const weekday of Object.keys(WEEKDAY_INDEX) as TrainingWeekday[]) {
      if (!byWeekday.has(weekday)) {
        byWeekday.set(weekday, createWeeklyTrainingSlot(weekday, FALLBACK_ROLE_BY_WEEKDAY[weekday]))
      }
    }
  }

  return [...byWeekday.values()]
}

function respectsSelectionConstraints(
  slots: WeeklyTrainingSlot[],
  context: WeeklySlotSelectionContext,
) {
  if (context.includesRace && !slots.some((slot) => slot.role === 'competition')) return false

  const intenseSessionsTarget = context.intenseSessionsTarget ?? 0
  if (intenseSessionsTarget <= 0 || !context.weekStartDate) return true

  const dated = slots.map((slot) => ({
    slot,
    date: dateForWeekday(context.weekStartDate as string, slot.weekday),
  }))
  return selectIntenseSlots(
    dated,
    intenseSessionsTarget,
    context.minimumRecoveryDays ?? 0,
  ).length >= Math.min(intenseSessionsTarget, slots.length)
}

function getCombinationScore(
  combination: WeeklyTrainingSlot[],
  habitualSlots: WeeklyTrainingSlot[],
  microcycleType: MicrocycleType,
) {
  const habitualKeys = new Set(habitualSlots.map((slot) => slot.key))
  const roleDiversity = new Set(combination.map((slot) => slot.role)).size * 5

  return combination.reduce((score, slot) => (
    score + getSlotSelectionScore(slot, microcycleType) + (habitualKeys.has(slot.key) ? 15 : 0)
  ), roleDiversity)
}

function compareCombinationOrder(left: WeeklyTrainingSlot[], right: WeeklyTrainingSlot[]) {
  return left
    .map((slot) => WEEKDAY_INDEX[slot.weekday])
    .sort((a, b) => a - b)
    .join('')
    .localeCompare(
      right.map((slot) => WEEKDAY_INDEX[slot.weekday]).sort((a, b) => a - b).join(''),
    )
}

function assertUniqueSlotWeekdays(slots: WeeklyTrainingSlot[]) {
  const weekdays = new Set<TrainingWeekday>()
  for (const slot of slots) {
    if (weekdays.has(slot.weekday)) {
      throw new RangeError(`Weekly pattern contains duplicated weekday: ${slot.weekday}`)
    }
    weekdays.add(slot.weekday)
  }
}

function dateForWeekday(weekStartDate: string, weekday: TrainingWeekday) {
  const start = parseIsoDate(weekStartDate)
  if (Number.isNaN(start.getTime())) throw new RangeError('Invalid week start date')

  const startWeekday = start.getUTCDay() === 0 ? 7 : start.getUTCDay()
  const offset = (WEEKDAY_INDEX[weekday] - startWeekday + 7) % 7
  const date = new Date(start)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function compareByWeekday(a: WeeklyTrainingSlot, b: WeeklyTrainingSlot) {
  return WEEKDAY_INDEX[a.weekday] - WEEKDAY_INDEX[b.weekday]
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
