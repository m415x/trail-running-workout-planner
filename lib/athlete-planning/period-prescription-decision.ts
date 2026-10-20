import type { AthletePlanningResolution } from '@/lib/planning-cohorts/planning-resolution'
import type { AthleteSessionPrescriptionResolution } from '@/lib/planning-cohorts/athlete-session-prescription'

/**
 * Period reader's pre-adjustment decision. Kept separate so its fail-closed
 * behavior can be verified without a mutable database or a user session.
 */
export function decideAthletePeriodPrescription(
  planning: AthletePlanningResolution,
  prescription: AthleteSessionPrescriptionResolution,
):
  | { kind: 'continue' }
  | { kind: 'omit' }
  | { kind: 'conflict'; reason: string } {
  if (planning.status === 'conflict') return { kind: 'conflict', reason: planning.reason }
  if (prescription.status === 'conflict') return { kind: 'conflict', reason: prescription.reason }
  if (prescription.status !== 'resolved') {
    return { kind: 'omit' }
  }
  return { kind: 'continue' }
}
