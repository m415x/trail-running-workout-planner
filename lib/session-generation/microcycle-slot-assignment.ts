import type {
  MicrocycleSlotAssignmentResult,
  SessionGenerationContext,
  TrainingWeekday,
  WeeklyTrainingSlot,
} from '@/types/training/session-generation.types'

const WEEKDAY_BY_UTC_DAY: Record<number, TrainingWeekday> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

type MicrocycleAssignmentContext = Pick<
  SessionGenerationContext,
  'microcycleId' | 'startDate' | 'endDate'
>

/**
 * Converts selected weekly slots into concrete dates owned by the source
 * microcycle. The caller never supplies a microcycle per session: every
 * assignment inherits the single planning context that is being generated.
 *
 * Edited microcycles may contain fewer than seven days. A configured weekday
 * outside that range is omitted with a warning instead of being wrapped into
 * a neighbouring microcycle.
 */
export function assignSlotsToMicrocycle(
  context: MicrocycleAssignmentContext,
  slots: WeeklyTrainingSlot[],
): MicrocycleSlotAssignmentResult {
  const { start, end, durationDays } = assertValidContext(context)
  assertValidSlots(slots)

  const dateByWeekday = new Map<TrainingWeekday, string>()
  for (let offset = 0; offset < durationDays; offset += 1) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + offset)
    dateByWeekday.set(WEEKDAY_BY_UTC_DAY[date.getUTCDay()], formatIsoDate(date))
  }

  const assignments = slots.flatMap((slot) => {
    const date = dateByWeekday.get(slot.weekday)
    return date
      ? [{ slot, date, microcycleId: context.microcycleId }]
      : []
  }).sort((left, right) => left.date.localeCompare(right.date))
  const assignedKeys = new Set(assignments.map(({ slot }) => slot.key))
  const omittedSlotKeys = slots
    .filter((slot) => !assignedKeys.has(slot.key))
    .map((slot) => slot.key)
  const warnings = omittedSlotKeys.map((slotKey) => (
    `El slot ${slotKey} quedó fuera del rango ${formatIsoDate(start)} a ${formatIsoDate(end)} del microciclo.`
  ))

  return { assignments, omittedSlotKeys, warnings }
}

function assertValidContext(context: MicrocycleAssignmentContext) {
  if (!context.microcycleId.trim()) {
    throw new RangeError('Microcycle id is required for automatic slot assignment')
  }

  const start = parseIsoDate(context.startDate)
  const end = parseIsoDate(context.endDate)
  if (!start || !end) throw new RangeError('Microcycle dates must use valid YYYY-MM-DD values')

  const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (durationDays < 1 || durationDays > 7) {
    throw new RangeError('A microcycle assignment range must contain between 1 and 7 days')
  }

  return { start, end, durationDays }
}

function assertValidSlots(slots: WeeklyTrainingSlot[]) {
  const keys = new Set<string>()
  const weekdays = new Set<TrainingWeekday>()

  for (const slot of slots) {
    if (!slot.key.trim() || keys.has(slot.key)) {
      throw new RangeError(`Weekly assignment slots require unique non-empty keys: ${slot.key}`)
    }
    if (weekdays.has(slot.weekday)) {
      throw new RangeError(`Weekly assignment slots contain a duplicated weekday: ${slot.weekday}`)
    }
    keys.add(slot.key)
    weekdays.add(slot.weekday)
  }
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || formatIsoDate(date) !== value ? null : date
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
