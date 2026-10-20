/**
 * A reusable SELF read boundary for a planning period.
 *
 * The caller supplies the existing H5A resolver and the effective planning
 * reader. This boundary never accepts a client-selected athlete or Team.
 * Planning/prescription/adjustment conflicts are failures, not empty periods.
 */
export interface AthleteSelfPeriod {
  startDate: string
  endDate: string
}

export interface AthleteSelfPeriodSubject {
  userId: string
  teamId: string
  athleteProfileId: string
}

export type AthleteSelfPeriodAuthority =
  | { status: 'resolved'; subject: AthleteSelfPeriodSubject }
  | { status: 'denied' }

export type EffectivePeriodLoadResult<TSession> =
  | { status: 'loaded'; sessions: TSession[] }
  | { status: 'empty' }
  | { status: 'conflict'; reason: string }
  | { status: 'error' }

export type AthleteSelfPeriodReadResult<TSession> =
  | { status: 'loaded'; sessions: TSession[] }
  | { status: 'empty' }
  | { status: 'denied' }
  | { status: 'error' }

export function createAthleteSelfPeriodRead<TSession>(dependencies: {
  resolveSelf: () => Promise<AthleteSelfPeriodAuthority>
  loadEffectivePeriod: (
    scope: AthleteSelfPeriod & AthleteSelfPeriodSubject
  ) => Promise<EffectivePeriodLoadResult<TSession>>
}) {
  return async (period: AthleteSelfPeriod): Promise<AthleteSelfPeriodReadResult<TSession>> => {
    try {
      const authority = await dependencies.resolveSelf()
      if (authority.status !== 'resolved') return { status: 'denied' }

      const result = await dependencies.loadEffectivePeriod({
        ...period,
        ...authority.subject,
      })

      if (result.status === 'loaded') return result
      if (result.status === 'empty') return { status: 'empty' }
      return { status: 'error' }
    } catch {
      return { status: 'error' }
    }
  }
}
