import { selectCoachHomeNextCompetition } from './next-competition'
import type { CoachHomeNextCompetitionResult } from './next-competition'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'

type Unavailable = 'denied' | 'selection_required' | 'invalid_context' | 'error'
type Candidate = Pick<CompetitionEntry, 'id' | 'groupTrainingPlanId' | 'name' | 'date' | 'status' | 'priority' | 'distanceKm' | 'isDeleted'>

/**
 * Existing planning reader authorizes every Plan independently. This service
 * only reads the calendar after that result is ready, in a single SQL batch.
 */
export function createCoachHomeNextCompetitionReader(deps: {
  loadAuthorizedPlans(): Promise<{ status: Unavailable | 'empty' } | { status: 'ready'; plans: readonly { id: string }[] }>
  readCandidates(authorizedPlanIds: readonly string[], today: string): Promise<readonly Candidate[]>
  today(): string
}) {
  return {
    async read(): Promise<CoachHomeNextCompetitionResult> {
      try {
        const planning = await deps.loadAuthorizedPlans()
        if (planning.status !== 'ready') return { status: planning.status }
        const authorizedPlanIds = [...new Set(planning.plans.map((plan) => plan.id))]
        if (authorizedPlanIds.length === 0) return { status: 'empty' }
        const today = deps.today()
        const entries = await deps.readCandidates(authorizedPlanIds, today)
        return selectCoachHomeNextCompetition({
          planning: { status: 'ready', authorizedPlanIds },
          calendar: { status: 'ready', entries },
          today,
        })
      } catch {
        return { status: 'error' }
      }
    },
  }
}
