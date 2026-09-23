import { and, eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { workoutLogEvidence } from '@/db/readiness-schema'
import {
  athleteProfiles,
  groupSessionPrescriptions,
  microcycles,
  sessions,
  workoutLogs,
} from '@/db/schema'

const TEAM_ID = 'team_1'
const ATHLETE_ID = 'profile_user_2'
const FIXTURE_PREFIX = 'kan308_'
const HISTORICAL_MICROCYCLE_ID = 'kan297_microcycle'

function formatISODate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function shiftISODate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return formatISODate(date)
}

function getMondayFromISODate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return formatISODate(date)
}

function getCurrentDateInArgentina() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

async function seedPlanRealComparisonFixtures() {
  console.log('⚖️ Seeding plan-real comparison walkthrough fixtures...')

  const athlete = await db
    .select({ id: athleteProfiles.id, groupId: athleteProfiles.groupId })
    .from(athleteProfiles)
    .where(and(
      eq(athleteProfiles.id, ATHLETE_ID),
      eq(athleteProfiles.teamId, TEAM_ID),
    ))
    .get()

  if (!athlete?.groupId) {
    throw new Error('Run `pn db:seed:realized-training` first: Ana Acosta and her group are required.')
  }

  const historicalMicrocycle = await db
    .select({ id: microcycles.id })
    .from(microcycles)
    .where(eq(microcycles.id, HISTORICAL_MICROCYCLE_ID))
    .get()

  if (!historicalMicrocycle) {
    throw new Error('Run `pn db:seed:realized-training` first: the historical walkthrough microcycle is required.')
  }

  const currentWeekStart = getMondayFromISODate(getCurrentDateInArgentina())
  const fixtureWeekStart = shiftISODate(currentWeekStart, -7)
  const matchedDate = fixtureWeekStart
  const knownNotCompletedDate = shiftISODate(fixtureWeekStart, 5)

  const sessionRows: Array<typeof sessions.$inferInsert> = [
    {
      id: `${FIXTURE_PREFIX}session_matched`,
      teamId: TEAM_ID,
      workoutId: null,
      date: matchedDate,
      title: 'KAN-308 — Exact plan-real match',
      type: 'Base',
      locationKey: null,
      trackPath: null,
      structure: null,
      notes: 'Plan-real walkthrough fixture with exactly matching comparable metrics.',
      generationOwnership: 'manual',
      sharedEventKey: null,
    },
    {
      id: `${FIXTURE_PREFIX}session_known_not_completed`,
      teamId: TEAM_ID,
      workoutId: null,
      date: knownNotCompletedDate,
      title: 'KAN-308 — Explicitly not completed',
      type: 'Base',
      locationKey: null,
      trackPath: null,
      structure: null,
      notes: 'Plan-real walkthrough fixture with explicit missed evidence.',
      generationOwnership: 'manual',
      sharedEventKey: null,
    },
  ]

  for (const session of sessionRows) {
    await db.insert(sessions).values(session).onConflictDoUpdate({
      target: sessions.id,
      set: {
        date: session.date,
        title: session.title,
        type: session.type,
        notes: session.notes,
      },
    }).run()
  }

  const prescriptionRows: Array<typeof groupSessionPrescriptions.$inferInsert> = [
    {
      id: `${FIXTURE_PREFIX}prescription_matched`,
      sessionId: `${FIXTURE_PREFIX}session_matched`,
      groupId: athlete.groupId,
      microcycleId: historicalMicrocycle.id,
      distanceKm: 6,
      durationMin: 40,
      elevationGain: 180,
      intensityMethod: null,
      zone: null,
      referencePercentage: null,
      notes: 'KAN-308 matched comparison fixture.',
      generationOwnership: 'manual',
      generationKey: null,
    },
    {
      id: `${FIXTURE_PREFIX}prescription_known_not_completed`,
      sessionId: `${FIXTURE_PREFIX}session_known_not_completed`,
      groupId: athlete.groupId,
      microcycleId: historicalMicrocycle.id,
      distanceKm: 5,
      durationMin: 35,
      elevationGain: 120,
      intensityMethod: null,
      zone: null,
      referencePercentage: null,
      notes: 'KAN-308 explicit known-not-completed comparison fixture.',
      generationOwnership: 'manual',
      generationKey: null,
    },
  ]

  for (const prescription of prescriptionRows) {
    await db.insert(groupSessionPrescriptions).values(prescription).onConflictDoUpdate({
      target: groupSessionPrescriptions.id,
      set: {
        groupId: prescription.groupId,
        microcycleId: prescription.microcycleId,
        distanceKm: prescription.distanceKm,
        durationMin: prescription.durationMin,
        elevationGain: prescription.elevationGain,
      },
    }).run()
  }

  const logRows: Array<typeof workoutLogs.$inferInsert> = [
    {
      id: `${FIXTURE_PREFIX}log_matched`,
      athleteId: ATHLETE_ID,
      sessionId: `${FIXTURE_PREFIX}session_matched`,
      workoutId: null,
      date: matchedDate,
      status: 'completed',
      distanceKm: 6,
      durationMin: 40,
      elevationGain: 180,
      avgHr: 142,
      feeling: 'good',
      rpe: 4,
      athleteNotes: 'Exact match fixture for KAN-259 walkthrough.',
      performedAt: `${matchedDate}T19:00:00-03:00`,
      loggedAt: `${matchedDate}T21:00:00-03:00`,
    },
    {
      id: `${FIXTURE_PREFIX}log_known_not_completed`,
      athleteId: ATHLETE_ID,
      sessionId: `${FIXTURE_PREFIX}session_known_not_completed`,
      workoutId: null,
      date: knownNotCompletedDate,
      status: 'missed',
      distanceKm: 0,
      durationMin: 0,
      elevationGain: 0,
      avgHr: null,
      feeling: null,
      rpe: 0,
      athleteNotes: 'Explicit missed evidence for KAN-259 walkthrough.',
      performedAt: null,
      loggedAt: `${knownNotCompletedDate}T22:00:00-03:00`,
    },
  ]

  for (const log of logRows) {
    await db.insert(workoutLogs).values(log).onConflictDoUpdate({
      target: workoutLogs.id,
      set: {
        sessionId: log.sessionId,
        date: log.date,
        status: log.status,
        distanceKm: log.distanceKm,
        durationMin: log.durationMin,
        elevationGain: log.elevationGain,
        avgHr: log.avgHr,
        feeling: log.feeling,
        rpe: log.rpe,
        athleteNotes: log.athleteNotes,
        performedAt: log.performedAt,
        loggedAt: log.loggedAt,
      },
    }).run()
  }

  const evidenceRows: Array<typeof workoutLogEvidence.$inferInsert> = [
    {
      id: `${FIXTURE_PREFIX}evidence_matched`,
      workoutLogId: `${FIXTURE_PREFIX}log_matched`,
      source: 'manual',
      sourceActivityId: null,
      knownMetricFields: ['distanceKm', 'durationMin', 'elevationGainM', 'avgHrBpm', 'rpe'],
    },
    {
      id: `${FIXTURE_PREFIX}evidence_known_not_completed`,
      workoutLogId: `${FIXTURE_PREFIX}log_known_not_completed`,
      source: 'manual',
      sourceActivityId: null,
      knownMetricFields: [],
    },
  ]

  await db.insert(workoutLogEvidence).values(evidenceRows).onConflictDoNothing().run()

  console.log('✅ Plan-real comparison fixtures initialized for Ana Acosta.')
  console.log('   • exact matched prescribed session')
  console.log('   • explicit known-not-completed prescribed session')
  console.log('   • existing KAN-297 fixtures continue to provide deviation, partial, unknown and unplanned cases')
}

seedPlanRealComparisonFixtures().catch(error => {
  console.error('❌ Failed to initialize plan-real comparison fixtures:', error)
  process.exitCode = 1
})
