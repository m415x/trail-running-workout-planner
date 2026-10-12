import { shiftAthletePlanWeek } from './plan-week-navigation'

/** Groups already-resolved effective sessions by their effective civil date. */
export function selectEffectiveAthletePlanWeek<TSession extends { id: string; date: string }>(input: {
  monday: string
  effectiveSessions: readonly TSession[]
}): { status: 'loaded'; sessions: TSession[]; days: Array<{ date: string; sessions: TSession[] }> } | { status: 'error' } {
  let nextMonday: string
  try {
    nextMonday = shiftAthletePlanWeek(input.monday, 1)
  } catch {
    return { status: 'error' }
  }

  const byId = new Map<string, TSession>()
  for (const session of input.effectiveSessions) {
    const previous = byId.get(session.id)
    if (previous) {
      if (previous.date !== session.date) return { status: 'error' }
      continue
    }
    byId.set(session.id, session)
  }

  const sessions = [...byId.values()]
    .filter((session) => session.date >= input.monday && session.date < nextMonday)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  const days: Array<{ date: string; sessions: TSession[] }> = []
  const start = new Date(`${input.monday}T00:00:00.000Z`)
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + offset)
    const civilDate = date.toISOString().slice(0, 10)
    days.push({ date: civilDate, sessions: sessions.filter((session) => session.date === civilDate) })
  }

  return { status: 'loaded', sessions, days }
}
