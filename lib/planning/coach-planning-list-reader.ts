/**
 * KAN-696/T1 — discriminate Coach list authorization from an authorized empty collection.
 * The caller supplies H2/H3/H4A decisions and persisted Team-scoped ownership evidence.
 * A missing collection never authorizes the actor.
 */
export type CoachPlanningListContext =
  | { status: 'resolved'; actorId: string; teamId: string }
  | { status: 'denied' }
  | { status: 'error' }

export type CoachPlanningListResult<TPlan> =
  | { status: 'denied' }
  | { status: 'empty' }
  | { status: 'ready'; plans: TPlan[] }
  | { status: 'error' }

export interface CoachPlanningListReaderDeps<TPlan extends { teamId: string }> {
  resolveContext(): Promise<CoachPlanningListContext>
  authorizeListing(context: Extract<CoachPlanningListContext, { status: 'resolved' }>): Promise<boolean>
  loadPlans(context: Extract<CoachPlanningListContext, { status: 'resolved' }>): Promise<TPlan[]>
  authorizePlan(
    context: Extract<CoachPlanningListContext, { status: 'resolved' }>,
    plan: TPlan,
  ): Promise<boolean>
}

export function createCoachPlanningListReader<TPlan extends { teamId: string }>(
  deps: CoachPlanningListReaderDeps<TPlan>,
) {
  return {
    async read(): Promise<CoachPlanningListResult<TPlan>> {
      try {
        const context = await deps.resolveContext()
        if (context.status === 'denied') return { status: 'denied' }
        if (context.status === 'error') return { status: 'error' }

        if (!(await deps.authorizeListing(context))) return { status: 'denied' }

        const plans = await deps.loadPlans(context)
        const sameTeam = plans.filter((plan) => plan.teamId === context.teamId)
        const decisions = await Promise.all(
          sameTeam.map((plan) => deps.authorizePlan(context, plan)),
        )
        const allowed = sameTeam.filter((_plan, index) => decisions[index] === true)
        return allowed.length === 0
          ? { status: 'empty' }
          : { status: 'ready', plans: allowed }
      } catch {
        // Operational failures must not be disguised as authorization denial.
        return { status: 'error' }
      }
    },
  }
}
