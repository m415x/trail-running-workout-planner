'use server'

import { createH5bSelfNextServerContext } from '@/lib/authorization/h5b-self-next-server'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { loadAthleteRaceRegistrations } from '@/lib/athlete-stats/athlete-race-registration-source'
import { createAthleteStatsAction } from '@/lib/athlete-stats/athlete-stats-action'
import { createAthleteStatsProductionSources } from '@/lib/athlete-stats/athlete-stats-production-wiring'
import { loadAthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import type { AthleteStatsReadRequest } from '@/lib/athlete-stats/athlete-stats-read-service'

const productionSources = createAthleteStatsProductionSources()

async function resolveCurrentAthleteStatsSubject() {
  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })
  const self = await createH5bSelfNextServerContext().resolve(access, {
    at: new Date().toISOString(),
    capability: 'stats.self.read',
  })
  return self.status === 'resolved'
    ? { athleteId: self.athleteProfileId, teamId: self.teamId }
    : null
}

const readStats = createAthleteStatsAction({
  resolveCurrentAthlete: resolveCurrentAthleteStatsSubject,
  loadProjectionInput: (subject, period) => (
    loadAthleteStatsProjectionInput(subject, period, productionSources)
  ),
})

/** Athlete-facing Stats boundary. Subject identity is always resolved server-side. */
export async function getCurrentAthleteStatsAction(request: AthleteStatsReadRequest) {
  return readStats(request)
}

/** Athlete-facing race registration/history boundary. Identity stays server-owned. */
export async function getCurrentAthleteRaceRegistrationsAction({
  today,
}: {
  today: string
}) {
  try {
    const subject = await resolveCurrentAthleteStatsSubject()
    if (!subject) return { status: 'denied' as const }
    const data = loadAthleteRaceRegistrations(subject, today)
    return { status: 'loaded' as const, data }
  } catch {
    return { status: 'error' as const }
  }
}
