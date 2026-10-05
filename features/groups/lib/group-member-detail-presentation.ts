import {
  projectAthleteAdministrativeRead,
  type AthleteAdministrativeReadInput,
} from '@/lib/athletes/administrative-read-model'

export interface GroupMemberDetailPresentation {
  name: string
  email: string | null
  phone: string | null
  initials: string
}

/** Builds read-only group presentation from the canonical administrative projection. */
export function projectGroupMemberDetail(
  athlete: AthleteAdministrativeReadInput,
): GroupMemberDetailPresentation {
  const administrative = projectAthleteAdministrativeRead(athlete)
  const name = administrative.name
  return {
    name: name ? `${name.firstName} ${name.lastName}` : `— (${athlete.id})`,
    email: administrative.email.value,
    phone: administrative.phone.value,
    initials: name
      ? `${name.firstName.charAt(0)}${name.lastName.charAt(0)}`.toUpperCase()
      : '—',
  }
}
