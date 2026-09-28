import { and, eq, isNull, ne, or } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import * as schema from '@/db/schema'
import { athleteGroups, athleteProfiles } from '@/db/schema'

export function getEligibleAthletesForSportingGroup(input: {
  db: BetterSQLite3Database<typeof schema>
  teamId: string
  groupId: string
}) {
  const group = input.db.query.athleteGroups.findFirst({
    where: and(
      eq(athleteGroups.id, input.groupId),
      eq(athleteGroups.teamId, input.teamId),
      eq(athleteGroups.isActive, true),
      eq(athleteGroups.isDeleted, false),
    ),
  }).sync()

  if (!group) return null

  const athletes = input.db.query.athleteProfiles.findMany({
    where: and(
      eq(athleteProfiles.teamId, input.teamId),
      eq(athleteProfiles.isActive, true),
      eq(athleteProfiles.isDeleted, false),
      or(
        isNull(athleteProfiles.groupId),
        ne(athleteProfiles.groupId, input.groupId),
      ),
    ),
    with: {
      user: true,
      group: true,
    },
  }).sync()

  athletes.sort((first, second) => {
    const firstName = `${first.user.lastName} ${first.user.firstName}`
    const secondName = `${second.user.lastName} ${second.user.firstName}`

    return firstName.localeCompare(secondName, 'es')
  })

  return { group, athletes }
}
