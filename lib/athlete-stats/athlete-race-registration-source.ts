import {
  projectAthleteRaceRegistrations,
  type AthleteRaceRegistrationsProjection,
} from '@/lib/athlete-stats/athlete-race-registration-projection'
import { listRaceRegistrationsForAthlete } from '@/lib/competitions/race-registration-repository'
import type { AthleteStatsSubject } from '@/lib/athlete-stats/athlete-stats-read-service'

export function loadAthleteRaceRegistrations(
  subject: AthleteStatsSubject,
  today: string,
): AthleteRaceRegistrationsProjection {
  const registrations = listRaceRegistrationsForAthlete({
    teamId: subject.teamId,
    athleteProfileId: subject.athleteId,
  })

  return projectAthleteRaceRegistrations(registrations, today)
}
