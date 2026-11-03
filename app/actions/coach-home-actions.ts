'use server'

import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'
import { createCoachHomeAthleteCountReader } from '@/lib/coach-home/athlete-count-reader'
import { createCoachHomeActiveAthleteCountQuery } from '@/lib/coach-home/athlete-count-query'
import { db } from '@/db'
import { getCoachPlanningListResult } from '@/app/actions/planning-actions'
import { projectCoachHomePlanning } from '@/lib/coach-home/planning-summary'
import { APPLICATION_REGIONAL_FALLBACKS } from '@/lib/regionalization/application-regional-context'

export async function getCoachHomeActiveAthleteCount() {
  const reader = createCoachHomeAthleteCountReader({
    async resolveContext() {
      const supabase = await createSupabaseServerClient()
      const access = await requireAuthenticatedEptAction({
        readAccess: () => readEptSessionAccessState(supabase.auth, createExternalIdentityLookup()),
      })
      if (access.status !== 'authenticated') return { status: 'denied' } as const
      const team = await createActiveTeamNextServerContext().resolve(access.userId)
      if (team.status === 'selection_required') return { status: 'selection_required' } as const
      if (team.status === 'invalid_context') return { status: 'invalid_context' } as const
      if (team.status !== 'resolved') return { status: 'denied' } as const
      return { status: 'resolved', actorId: access.userId, teamId: team.teamId } as const
    },
    async authorize(context) {
      const decision = await createH4aNextServerAuthorizationBoundary().authorize(
        { status: 'authenticated', userId: context.actorId },
        {
          capability: 'athlete.admin.manage',
          resource: { teamId: context.teamId },
          requiredScope: 'team',
          at: new Date().toISOString(),
        },
      )
      return decision.allowed === true && 'teamId' in decision && decision.teamId === context.teamId
    },
    countActive: createCoachHomeActiveAthleteCountQuery(db),
  })
  return reader.read()
}


/** The planning reader performs H2/H3/H4A per Plan before this bounded projection. */
export async function getCoachHomePlanningSummary() {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: APPLICATION_REGIONAL_FALLBACKS.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const result = await getCoachPlanningListResult()
  return projectCoachHomePlanning(result, date)
}
