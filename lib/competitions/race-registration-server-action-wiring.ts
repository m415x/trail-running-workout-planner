import { executeBulkRaceRegistration } from '@/lib/competitions/race-registration-command'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'
import type { RaceRegistrationPersistenceInput } from '@/types/training/race-registration.types'

type ExistingRegistration = {
  registrationId: string
  courseLabel: string
  registrationStatus?: string
}

type RegistrationLookup = {
  teamId: string
  athleteProfileId: string
  raceEditionId: string
}

type Sources = {
  getRaceCourse: (id: string) => RaceCourse | null
  getRaceEdition: (id: string) => RaceEdition | null
  getRaceEvent: (id: string) => RaceEvent | null
  listActiveAthleteProfileIds: (teamId: string) => Promise<string[]> | string[]
  findRaceRegistrationInEdition: (
    input: RegistrationLookup,
  ) => Promise<ExistingRegistration | null> | ExistingRegistration | null
  createRaceRegistration: (
    input: RaceRegistrationPersistenceInput,
  ) => Promise<RaceRegistrationPersistenceInput> | RaceRegistrationPersistenceInput
  createId: (athleteProfileId: string) => string
}

function isEffectiveRegistration(registration: ExistingRegistration | null) {
  return registration !== null && registration.registrationStatus !== 'cancelled'
}

export function buildRaceRegistrationActionDependencies(sources: Sources) {
  const findEffectiveRegistrationInEdition = async (input: RegistrationLookup) => {
    const registration = await sources.findRaceRegistrationInEdition(input)
    return isEffectiveRegistration(registration) ? registration : null
  }

  return {
    getRaceCourse: sources.getRaceCourse,
    getRaceEdition: sources.getRaceEdition,
    getRaceEvent: sources.getRaceEvent,
    listSelectableAthleteProfileIds: async (input: {
      teamId: string
      raceEditionId: string
    }) => {
      const athleteProfileIds = await sources.listActiveAthleteProfileIds(input.teamId)
      const selectable: string[] = []

      for (const athleteProfileId of athleteProfileIds) {
        const existing = await findEffectiveRegistrationInEdition({
          teamId: input.teamId,
          athleteProfileId,
          raceEditionId: input.raceEditionId,
        })
        if (!existing) selectable.push(athleteProfileId)
      }

      return selectable
    },
    executeBulkRegistration: (input: {
      teamId: string
      athleteProfileIds: string[]
      target: { event: RaceEvent; edition: RaceEdition; course: RaceCourse }
    }) => executeBulkRaceRegistration(input, {
      findEffectiveRegistrationInEdition,
      findRegistrationInEdition: sources.findRaceRegistrationInEdition,
      persistRegistration: sources.createRaceRegistration,
      createId: sources.createId,
    }),
  }
}
