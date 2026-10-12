'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { athleteProfiles } from '@/db/schema'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
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
  getRaceRegistration,
  updateRaceRegistration,
} from '@/lib/competitions/race-registration-repository'
import { executeRaceRegistrationServerAction } from '@/lib/competitions/race-registration-server-action-execution'
import { raceRegistrationRevalidationPaths } from '@/lib/competitions/race-registration-server-action'
import { buildRaceRegistrationActionDependencies } from '@/lib/competitions/race-registration-server-action-wiring'
import {
  applyRaceRegistrationCourseChange,
  applyRaceRegistrationLifecycle,
  updateRaceParticipation,
} from '@/lib/competitions/race-registration-service'
import type {
  RaceParticipationStatus,
  RaceRegistrationStatus,
} from '@/types/training/race-registration.types'

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

function nullableNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseRaceParticipationStatus(value: FormDataEntryValue | null): RaceParticipationStatus | null {
  if (typeof value !== 'string') return null
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

function parseLocale(value: FormDataEntryValue | null): 'es' | 'en' | null {
  return value === 'es' || value === 'en' ? value : null
}

function revalidateRaceRegistrationPaths(locale: 'es' | 'en') {
  for (const path of raceRegistrationRevalidationPaths(locale)) revalidatePath(path)
}

function parseRaceRegistrationStatus(value: FormDataEntryValue | null): RaceRegistrationStatus | null {
  if (value === 'registered' || value === 'cancelled') return value
  return null
}

export async function registerAthleteForRaceCourseAction(formData: FormData) {
  const locale = parseLocale(formData.get('locale'))
  const athleteProfileId = String(formData.get('athleteProfileId') ?? '')
  const raceCourseId = String(formData.get('raceCourseId') ?? '')
  if (!locale || !athleteProfileId || !raceCourseId) {
    return { ok: false as const, reason: 'invalid_input' as const }
  }

  const athlete = await db.query.athleteProfiles.findFirst({
    columns: { id: true, teamId: true },
    where: and(
      eq(athleteProfiles.id, athleteProfileId),
      eq(athleteProfiles.isDeleted, false),
    ),
  })
  if (!athlete) return { ok: false as const, reason: 'athlete_not_found' as const }

  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })
  if (access.status !== 'authenticated') {
    return { ok: false as const, reason: 'not_authorized' as const }
  }
  const authorization = await createH4aNextServerAuthorizationBoundary().authorize(access, {
    capability: 'competition.manage',
    resource: { teamId: athlete.teamId },
    at: new Date().toISOString(),
    requiredScope: 'team',
  })
  if (!authorization.allowed || !('teamId' in authorization) || authorization.teamId !== athlete.teamId) {
    return { ok: false as const, reason: 'not_authorized' as const }
  }

  try {
    const result = await runBulkRaceRegistrationAction(
      {
        teamId: athlete.teamId,
        raceCourseId,
        submittedAthleteProfileIds: [athleteProfileId],
      },
      dependencies,
    )
    revalidateRaceRegistrationPaths(locale)
    return { ok: true as const, result }
  } catch (error) {
    if (error instanceof Error && error.message === 'No eligible athletes remain selected for registration') {
      return { ok: false as const, reason: 'already_registered_in_edition' as const }
    }
    throw error
  }
}

export async function registerAthletesForRaceCourse(formData: FormData) {
  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })
  if (access.status !== 'authenticated') {
    throw new Error('not_authorized')
  }

  const activeTeam = await createActiveTeamNextServerContext().resolve(access.userId)
  if (activeTeam.status !== 'resolved') {
    throw new Error('not_authorized')
  }

  const authorization = await createH4aNextServerAuthorizationBoundary().authorize(access, {
    capability: 'competition.manage',
    resource: { teamId: activeTeam.teamId },
    at: new Date().toISOString(),
    requiredScope: 'team',
  })
  if (!authorization.allowed || !('teamId' in authorization) || authorization.teamId !== activeTeam.teamId) {
    throw new Error('not_authorized')
  }

  return executeRaceRegistrationServerAction(formData, {
    teamId: authorization.teamId,
    runBulkRegistration: (input) => runBulkRaceRegistrationAction(input, dependencies),
    revalidatePath,
  })
}

export async function changeRaceRegistrationCourseAction(formData: FormData) {
  const locale = parseLocale(formData.get('locale'))
  const registrationId = String(formData.get('registrationId') ?? '')
  const raceCourseId = String(formData.get('raceCourseId') ?? '')
  if (!locale || !registrationId || !raceCourseId) return { ok: false as const, reason: 'invalid_input' as const }

  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })
  if (access.status !== 'authenticated') {
    return { ok: false as const, reason: 'not_authorized' as const }
  }

  // Resolve the resource's Team from persistence; submitted ids are locators only.
  const stored = getRaceRegistration(registrationId)
  if (!stored) return { ok: false as const, reason: 'not_found' as const }

  const athlete = await db.query.athleteProfiles.findFirst({
    where: and(
      eq(athleteProfiles.id, stored.athleteProfileId),
      eq(athleteProfiles.teamId, stored.teamId),
      eq(athleteProfiles.isDeleted, false),
    ),
    columns: { id: true, teamId: true },
  })
  if (!athlete) return { ok: false as const, reason: 'not_authorized' as const }

  const authorization = await createH4aNextServerAuthorizationBoundary().authorize(access, {
    capability: 'competition.manage',
    resource: { teamId: stored.teamId },
    at: new Date().toISOString(),
    requiredScope: 'team',
  })
  if (!authorization.allowed || !('teamId' in authorization) || authorization.teamId !== stored.teamId) {
    return { ok: false as const, reason: 'not_authorized' as const }
  }

  const registration = getRaceRegistrationForTeam({
    teamId: authorization.teamId,
    registrationId,
  })
  if (!registration) return { ok: false as const, reason: 'not_found' as const }
  if (registration.registrationStatus !== 'registered' || registration.participationStatus !== 'unknown') {
    return { ok: false as const, reason: 'course_change_not_allowed' as const }
  }

  const course = getRaceCourse(raceCourseId)
  if (!course || course.isDeleted || course.raceEditionId !== registration.course.raceEditionId) {
    return { ok: false as const, reason: 'invalid_course' as const }
  }
  const edition = getRaceEdition(course.raceEditionId)
  if (!edition || edition.isDeleted) return { ok: false as const, reason: 'invalid_course' as const }
  const event = getRaceEvent(edition.raceEventId)
  if (!event || event.isDeleted) return { ok: false as const, reason: 'invalid_course' as const }

  const changed = applyRaceRegistrationCourseChange(registration, { event, edition, course })
  const persisted = updateRaceRegistration(changed)
  if (!persisted) return { ok: false as const, reason: 'not_found' as const }

  revalidateRaceRegistrationPaths(locale)
  return { ok: true as const, registration: persisted }
}

export async function updateRaceRegistrationLifecycleAction(formData: FormData) {
  const locale = parseLocale(formData.get('locale'))
  const registrationId = String(formData.get('registrationId') ?? '')
  const registrationStatus = parseRaceRegistrationStatus(formData.get('registrationStatus'))
  if (!locale || !registrationId || !registrationStatus) return { ok: false as const, reason: 'invalid_input' as const }

  const registration = getRaceRegistrationForTeam({
    teamId: CURRENT_TEAM_ID,
    registrationId,
  })
  if (!registration) return { ok: false as const, reason: 'not_found' as const }
  if (registration.participationStatus !== 'unknown') {
    return { ok: false as const, reason: 'lifecycle_change_not_allowed' as const }
  }

  const changed = applyRaceRegistrationLifecycle(registration, registrationStatus)
  const persisted = updateRaceRegistration(changed)
  if (!persisted) return { ok: false as const, reason: 'not_found' as const }

  revalidateRaceRegistrationPaths(locale)
  return { ok: true as const, registration: persisted }
}

export async function updateRaceParticipationAction(formData: FormData) {
  const locale = parseLocale(formData.get('locale'))
  const registrationId = String(formData.get('registrationId') ?? '')
  const participationStatus = parseRaceParticipationStatus(formData.get('participationStatus'))
  if (!locale || !registrationId || !participationStatus) return { ok: false as const, reason: 'invalid_input' as const }

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

  if (result.ok) revalidateRaceRegistrationPaths(locale)
  return result
}

/** Form-compatible adapters discard mutation result objects after server-side handling. */
export async function registerAthleteForRaceCourseFormAction(formData: FormData): Promise<void> {
  await registerAthleteForRaceCourseAction(formData)
}

export async function changeRaceRegistrationCourseFormAction(formData: FormData): Promise<void> {
  await changeRaceRegistrationCourseAction(formData)
}

export async function updateRaceRegistrationLifecycleFormAction(formData: FormData): Promise<void> {
  await updateRaceRegistrationLifecycleAction(formData)
}

export async function updateRaceParticipationFormAction(formData: FormData): Promise<void> {
  await updateRaceParticipationAction(formData)
}
