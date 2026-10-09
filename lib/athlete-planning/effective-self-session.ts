import {
  resolveAthletePlanningOnDate,
  type PlanningResolutionGroupChange,
  type PlanningResolutionMembership,
  type PlanningResolutionPlan,
} from '@/lib/planning-cohorts/planning-resolution'
import {
  resolveAthleteSessionPrescription,
  type AthleteSessionPrescriptionCandidate,
} from '@/lib/planning-cohorts/athlete-session-prescription'

/**
 * Pure, fail-closed SELF session/prescription ownership predicate.
 * All candidates must come from server-side persisted evidence; locators are
 * only used for equality against the effective planning projection.
 */
export function resolveEffectiveSelfSession(input: {
  athleteProfileId: string
  athleteId: string
  athleteTeamId: string
  currentGroupId: string | null
  groupChanges: PlanningResolutionGroupChange[]
  memberships: PlanningResolutionMembership[]
  basePlans: PlanningResolutionPlan[]
  sessionId: string
  prescriptionId?: string | null
  session: {
    id: string
    teamId: string
    date: string
    isDeleted: boolean
  } | null
  prescriptions: (AthleteSessionPrescriptionCandidate & { sessionId: string })[]
}): { status: 'resolved'; athleteProfileId: string; sessionId: string; prescriptionId: string } | { status: 'denied' } {
  if (
    !input.athleteProfileId
    || input.athleteProfileId !== input.athleteId
    || !input.session
    || input.session.isDeleted
    || input.session.id !== input.sessionId
    || input.session.teamId !== input.athleteTeamId
  ) return { status: 'denied' }

  try {
    const planning = resolveAthletePlanningOnDate({
      athleteTeamId: input.athleteTeamId,
      currentGroupId: input.currentGroupId,
      groupChanges: input.groupChanges,
      memberships: input.memberships,
      basePlans: input.basePlans,
      date: input.session.date,
    })
    if (planning.status !== 'resolved') return { status: 'denied' }

    const prescription = resolveAthleteSessionPrescription({
      planning,
      prescriptions: input.prescriptions.filter((candidate) => candidate.sessionId === input.sessionId),
    })
    if (prescription.status !== 'resolved') return { status: 'denied' }
    if (input.prescriptionId && input.prescriptionId !== prescription.prescriptionId) {
      return { status: 'denied' }
    }

    return {
      status: 'resolved',
      athleteProfileId: input.athleteProfileId,
      sessionId: input.sessionId,
      prescriptionId: prescription.prescriptionId,
    }
  } catch {
    return { status: 'denied' }
  }
}
