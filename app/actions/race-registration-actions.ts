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
  getRaceRegistrationForTeam,
  updateRaceRegistration,
} from '@/lib/competitions/race-registration-repository'
import { executeRaceRegistrationServerAction } from '@/lib/competitions/race-registration-server-action-execution'
import { buildRaceRegistrationActionDependencies } from '@/lib/competitions/race-registration-server-action-wiring'
import { updateRaceParticipation } from '@/lib/competitions/race-registration-service'
import type { RaceParticipationStatus } from '@/types/training/race-registration.types'

const CURRENT_TEAM_ID = 'team_1'
const PARTICIPATION_STATUSES: readonly RaceParticipationStatus[] = [
  'unknown',
  'started',
  'finished',
  'dnf',
  'dns',
]

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

function nullableNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseRaceParticipationStatus(value: FormDataEntryValue | null): RaceParticipationStatus | null {
  if (typeof value !== 'string' || !PARTICIPATION_STATUSES.includes(value)) return null
  switch (value) {
    case 'unknown':
    case 'started':
    case 'finished':
    case 'dnf':
    case 'dns':
      return value
    default:
      return null
  }
}

export async function registerAthletesForRaceCourse(formData: FormData) {
  return executeRaceRegistrationServerAction(formData, {
    teamId: CURRENT_TEAM_ID,
    runBulkRegistration: (input) => runBulkRaceRegistrationAction(input, dependencies),
    revalidatePath,
  })
}

export async function updateRaceParticipationAction(formData: FormData) {
  const registrationId = String(formData.get('registrationId') ?? '')
  const participationStatus = parseRaceParticipationStatus(formData.get('participationStatus'))
  if (!registrationId || !participationStatus) return { ok: false as const, reason: 'invalid_input' as const }

  const actualDistanceKm = nullableNumber(formData.get('actualDistanceKm'))
  const elapsedTimeSeconds = nullableNumber(formData.get('elapsedTimeSeconds'))

  const result = await updateRaceParticipation(
    {
      teamId: CURRENT_TEAM_ID,
      registrationId,
      participationStatus,
      actualDistanceKm,
      elapsedTimeSeconds,
    },
    {
      getRegistration: getRaceRegistrationForTeam,
      updateRegistration: updateRaceRegistration,
    },
  )

  if (result.ok) revalidatePath('/dashboard/competitions')
  return result
}
