import { resolveEffectiveSelfSession } from './effective-self-session'
import type {
  PlanningResolutionGroupChange,
  PlanningResolutionMembership,
  PlanningResolutionPlan,
} from '@/lib/planning-cohorts/planning-resolution'

interface PersistedSessionRow {
  id: string
  teamId: string
  date: string
  isDeleted: boolean | number
}

interface PersistedPrescriptionRow {
  id: string
  sessionId: string
  groupId: string
  groupTrainingPlanId: string
  microcycleId?: string
}

interface PersistedSessionRows {
  session: PersistedSessionRow | null | undefined
  prescriptions: PersistedPrescriptionRow[]
}

/** Load rows from storage; validate both session and effective plan before allowing SELF. */
export function resolvePersistedSelfSessionLink(input: {
  athleteProfileId: string
  athleteTeamId: string
  currentGroupId: string | null
  groupChanges: PlanningResolutionGroupChange[]
  memberships: PlanningResolutionMembership[]
  basePlans: PlanningResolutionPlan[]
  sessionId: string
  load(sessionId: string): PersistedSessionRows
}) {
  if (!input.athleteProfileId || !input.sessionId) return { status: 'denied' as const }

  try {
    const evidence = input.load(input.sessionId)
    if (!evidence.session) return { status: 'denied' as const }

    return resolveEffectiveSelfSession({
      athleteId: input.athleteProfileId,
      athleteProfileId: input.athleteProfileId,
      athleteTeamId: input.athleteTeamId,
      currentGroupId: input.currentGroupId,
      groupChanges: input.groupChanges,
      memberships: input.memberships,
      basePlans: input.basePlans,
      sessionId: input.sessionId,
      session: { ...evidence.session, isDeleted: Boolean(evidence.session.isDeleted) },
      prescriptions: evidence.prescriptions.map((prescription) => ({
        ...prescription,
        microcycleId: prescription.microcycleId ?? prescription.id,
      })),
    })
  } catch {
    return { status: 'denied' as const }
  }
}
