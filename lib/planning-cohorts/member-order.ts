import {
  projectAthleteAdministrativeRead,
  type AthleteAdministrativeReadInput,
} from '@/lib/athletes/administrative-read-model'

export interface PlanningCohortMemberForOrder {
  id: string
  startDate: string
  athleteProfile: AthleteAdministrativeReadInput
}

/**
 * Orders cohort history by administrative surname/name, missing names last,
 * then newest membership start and stable membership id.
 */
export function sortPlanningCohortMembers<T extends PlanningCohortMemberForOrder>(members: T[]): T[] {
  return members.sort((first, second) => {
    const firstName = projectAthleteAdministrativeRead(first.athleteProfile).name
    const secondName = projectAthleteAdministrativeRead(second.athleteProfile).name

    if (firstName === null && secondName !== null) return 1
    if (firstName !== null && secondName === null) return -1

    if (firstName && secondName) {
      const byLastName = firstName.lastName.localeCompare(secondName.lastName, 'es')
      if (byLastName !== 0) return byLastName
      const byFirstName = firstName.firstName.localeCompare(secondName.firstName, 'es')
      if (byFirstName !== 0) return byFirstName
    }

    const byStartDate = second.startDate.localeCompare(first.startDate)
    return byStartDate || first.id.localeCompare(second.id)
  })
}
