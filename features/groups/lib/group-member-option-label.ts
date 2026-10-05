import {
  projectAthleteAdministrativeRead,
  type AthleteAdministrativeReadInput,
} from '@/lib/athletes/administrative-read-model'

/** Human label for sporting/planning selectors without requiring an EPT User. */
export function getGroupMemberOptionName(athlete: AthleteAdministrativeReadInput): string {
  const administrative = projectAthleteAdministrativeRead(athlete)
  return administrative.name
    ? `${administrative.name.lastName}, ${administrative.name.firstName}`
    : `— (${athlete.id})`
}
