'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { athleteProfiles } from '@/db/schema'
import {
  getRaceCourse,
  getRaceEdition,
  getRaceEvent,
} from '@/lib/race-catalog/catalog-repository'
import { runBulkRaceRegistrationAction } from '@/lib/competitions/race-registration-action-service'
import {
  createRaceRegistration,
  findRaceRegistrationInEdition,
} from '@/lib/competitions/race-registration-repository'
import { executeRaceRegistrationServerAction } from '@/lib/competitions/race-registration-server-action-execution'
import { buildRaceRegistrationActionDependencies } from '@/lib/competitions/race-registration-server-action-wiring'

const CURRENT_TEAM_ID = 'team_1'

const dependencies = buildRaceRegistrationActionDependencies({
  getRaceCourse,
  getRaceEdition,
  getRaceEvent,
  listActiveAthleteProfileIds: async (teamId) => {
    const athletes = await db.query.athleteProfiles.findMany({
      columns: { id: true },
      where: and(
        eq(athleteProfiles.teamId, teamId),
        eq(athleteProfiles.isDeleted, false),
      ),
    })
    return athletes.map((athlete) => athlete.id)
  },
  findRaceRegistrationInEdition,
  createRaceRegistration,
  createId: () => randomUUID(),
})

export async function registerAthletesForRaceCourse(formData: FormData) {
  return executeRaceRegistrationServerAction(formData, {
    teamId: CURRENT_TEAM_ID,
    runBulkRegistration: (input) => runBulkRaceRegistrationAction(input, dependencies),
    revalidatePath,
  })
}
