import type { AthleteSelfPeriod, AthleteSelfPeriodSubject, AthleteSelfPeriodAuthority } from './self-period-read'
import { resolveAthletePlanningOnDate } from '@/lib/planning-cohorts/planning-resolution'
import { resolveAthleteSessionPrescription } from '@/lib/planning-cohorts/athlete-session-prescription'
import { resolveAthletePlanningSession } from '@/lib/planning-cohorts/athlete-planning-session-resolution'

export type IntegratedPeriodResult<T> =
  | { status: 'loaded'; sessions: T[] }
  | { status: 'empty' }
  | { status: 'conflict'; reason: string }
  | { status: 'error' }

/**
 * Authenticated request adapter. Reuse the canonical dated plan, prescription
 * and effective adjustment resolvers in the repository implementation.
 * Loading remains scoped to server-resolved subject, never URL-supplied IDs.
 */
export function createIntegratedAthleteSelfPeriodRead<T>(dependencies: {
  resolveSelf: () => Promise<AthleteSelfPeriodAuthority>
  loadPlanningEvidence: (scope: AthleteSelfPeriod & AthleteSelfPeriodSubject) => Promise<IntegratedPeriodResult<T>>
}) {
  return async (period: AthleteSelfPeriod) => {
    // Explicitly preserve conflict as a separate diagnostic outcome for the
    // integrating consumer; generic retrieval failure remains error.
    let authority: AthleteSelfPeriodAuthority
    try {
      authority = await dependencies.resolveSelf()
      if (authority.status !== 'resolved') return { status: 'denied' as const }
      const result = await dependencies.loadPlanningEvidence({ ...period, ...authority.subject })
      if (result.status === 'conflict') return result
      if (result.status === 'loaded' || result.status === 'empty') return result
      return { status: 'error' as const }
    } catch {
      return { status: 'error' as const }
    }
  }
}

// Canonical resolvers are the single source of effective planning authority.
// These exports are kept for the live integration adapter; no local duplicate
// of historical group, Base/Variant or athlete-adjustment rules is introduced.
export const integratedPlanningResolvers = {
  resolveAthletePlanningOnDate,
  resolveAthleteSessionPrescription,
  resolveAthletePlanningSession,
}
