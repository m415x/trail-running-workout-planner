'use server'

import { getCurrentAthlete } from '@/app/actions/dashboard-actions'
import { createAthleteStatsAction } from '@/lib/athlete-stats/athlete-stats-action'
import { createAthleteStatsProductionSources } from '@/lib/athlete-stats/athlete-stats-production-wiring'
import { loadAthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import type { AthleteStatsReadRequest } from '@/lib/athlete-stats/athlete-stats-read-service'

const productionSources = createAthleteStatsProductionSources()

const readStats = createAthleteStatsAction({
  getCurrentAthlete,
  loadProjectionInput: (subject, period) => (
    loadAthleteStatsProjectionInput(subject, period, productionSources)
  ),
})

/** Athlete-facing Stats boundary. Subject identity is always resolved server-side. */
export async function getCurrentAthleteStatsAction(request: AthleteStatsReadRequest) {
  return readStats(request)
}
