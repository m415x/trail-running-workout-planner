/**
 * H6 prior-month debt decision. This pure boundary never persists a block
 * flag or treats missing billing evidence as proof of debt.
 */
export type H6DebtDecision = { status: 'allowed' | 'blocked' | 'unavailable' }

export interface H6DebtCharge {
  year: number
  month: number
  remainingMinor: number
  effectiveDueDate: string
}

function civilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d
}

export async function evaluateH6PriorDebt(input: {
  teamId: string
  athleteProfileId: string
  /** Server-owned civil day in America/Argentina/Buenos_Aires. */
  cutoffDate: string
  loadCharges(teamId: string, athleteProfileId: string): Promise<readonly H6DebtCharge[] | null>
}): Promise<H6DebtDecision> {
  if (!input.teamId || !input.athleteProfileId || !civilDate(input.cutoffDate)) {
    return { status: 'unavailable' }
  }
  try {
    const charges = await input.loadCharges(input.teamId, input.athleteProfileId)
    if (!charges) return { status: 'unavailable' }
    const currentYear = Number(input.cutoffDate.slice(0, 4))
    const currentMonth = Number(input.cutoffDate.slice(5, 7))
    let blocked = false
    for (const charge of charges) {
      if (!Number.isInteger(charge.year) || charge.year < 1 ||
        !Number.isInteger(charge.month) || charge.month < 1 || charge.month > 12 ||
        !Number.isSafeInteger(charge.remainingMinor) || charge.remainingMinor < 0 ||
        !civilDate(charge.effectiveDueDate)) return { status: 'unavailable' }
      const previous = charge.year < currentYear ||
        (charge.year === currentYear && charge.month < currentMonth)
      if (previous && charge.remainingMinor > 0 && input.cutoffDate > charge.effectiveDueDate) {
        blocked = true
      }
    }
    return { status: blocked ? 'blocked' : 'allowed' }
  } catch {
    return { status: 'unavailable' }
  }
}

/** Civil day in the approved economic timezone, regardless of server locale. */
export function h6BuenosAiresCivilDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const field = (type: string) => parts.find((part) => part.type === type)?.value
  return [field('year'), field('month'), field('day')].join('-')
}
