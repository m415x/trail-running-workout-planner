import { and, eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { workoutLogEvidence } from '@/db/readiness-schema'
import { athleteProfiles, sessions, workoutLogs } from '@/db/schema'

const TEAM_ID = 'team_1'
const ATHLETE_ID = 'profile_user_2'
const FIXTURE_PREFIX = 'kan297_'

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

function getCurrentDateInArgentina() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

async function seedRealizedTrainingFixtures() {
  console.log('🏃 Seeding realized-training walkthrough fixtures...')

  const athlete = await db
    .select({ id: athleteProfiles.id })
    .from(athleteProfiles)
    .where(and(eq(athleteProfiles.id, ATHLETE_ID), eq(athleteProfiles.teamId, TEAM_ID)))
    .get()

  if (!athlete) {
    throw new Error('Run `pn db:seed:base` first: the Ana Acosta fixture is required.')
  }

  const today = getCurrentDateInArgentina()
  const completedDate = shiftISODate(today, -4)
  const partialDate = shiftISODate(today, -3)
  const missedDate = shiftISODate(today, -2)
  const extraDate = shiftISODate(today, -1)
  const now = new Date().toISOString()

  const sessionRows = [
    {
      id: `${FIXTURE_PREFIX}session_completed`,
      teamId: TEAM_ID,
      workoutId: null,
      date: completedDate,
      title: 'KAN-297 — Easy trail completed',
      type: 'Trail' as const,
      locationKey: null,
      trackPath: null,
      structure: null,
      notes: 'Walkthrough fixture: prescribed session with completed realized evidence.',
      generationOwnership: 'manual' as const,
      sharedEventKey: null,
    },
    {
      id: `${FIXTURE_PREFIX}session_partial`,
      teamId: TEAM_ID,
      workoutId: null,
      date: partialDate,
      title: 'KAN-297 — Progressive trail partial',
      type: 'Trail' as const,
      locationKey: null,
      trackPath: null,
      structure: null,
      notes: 'Walkthrough fixture: prescribed session with partial realized evidence.',
      generationOwnership: 'manual' as const,
      sharedEventKey: null,
    },
    {
      id: `${FIXTURE_PREFIX}session_missed`,
      teamId: TEAM_ID,
      workoutId: null,
      date: missedDate,
      title: 'KAN-297 — Missed prescribed session',
      type: 'Base' as const,
      locationKey: null,
      trackPath: null,
      structure: null,
      notes: 'Walkthrough fixture: expired prescribed session without realized evidence.',
      generationOwnership: 'manual' as const,
      sharedEventKey: null,
    },
  ]

  await db.insert(sessions).values(sessionRows).onConflictDoNothing().run()

  const logRows = [
    {
      id: `${FIXTURE_PREFIX}log_completed`,
      athleteId: ATHLETE_ID,
      sessionId: `${FIXTURE_PREFIX}session_completed`,
      workoutId: null,
      date: completedDate,
      status: 'completed' as const,
      distanceKm: 8,
      durationMin: 52.5,
      elevationGain: 320,
      avgHr: 148,
      feeling: 'good',
      rpe: 5,
      athleteNotes: 'Completed as prescribed.',
      performedAt: `${completedDate}T19:10:00-03:00`,
      loggedAt: `${completedDate}T21:00:00-03:00`,
    },
    {
      id: `${FIXTURE_PREFIX}log_partial`,
      athleteId: ATHLETE_ID,
      sessionId: `${FIXTURE_PREFIX}session_partial`,
      workoutId: null,
      date: partialDate,
      status: 'partial' as const,
      distanceKm: 5.4,
      durationMin: 41.25,
      elevationGain: 180,
      avgHr: null,
      feeling: 'tired',
      rpe: 7,
      athleteNotes: 'Stopped early; useful partial evidence.',
      performedAt: `${partialDate}T19:20:00-03:00`,
      loggedAt: `${partialDate}T22:15:00-03:00`,
    },
    {
      id: `${FIXTURE_PREFIX}log_extra`,
      athleteId: ATHLETE_ID,
      sessionId: null,
      workoutId: null,
      date: extraDate,
      status: 'completed' as const,
      distanceKm: 6.2,
      durationMin: 38.75,
      elevationGain: 95,
      avgHr: null,
      feeling: 'good',
      rpe: 4,
      athleteNotes: 'Extra run on a day without an official session.',
      performedAt: `${extraDate}T18:40:00-03:00`,
      loggedAt: now,
    },
  ]

  await db.insert(workoutLogs).values(logRows).onConflictDoNothing().run()

  await db
    .insert(workoutLogEvidence)
    .values([
      {
        id: `${FIXTURE_PREFIX}evidence_completed`,
        workoutLogId: `${FIXTURE_PREFIX}log_completed`,
        source: 'manual',
        sourceActivityId: null,
        knownMetricFields: ['distanceKm', 'durationMin', 'elevationGain', 'avgHr', 'rpe'],
      },
      {
        id: `${FIXTURE_PREFIX}evidence_partial`,
        workoutLogId: `${FIXTURE_PREFIX}log_partial`,
        source: 'manual',
        sourceActivityId: null,
        knownMetricFields: ['distanceKm', 'durationMin', 'elevationGain', 'rpe'],
      },
      {
        id: `${FIXTURE_PREFIX}evidence_extra`,
        workoutLogId: `${FIXTURE_PREFIX}log_extra`,
        source: 'manual',
        sourceActivityId: null,
        knownMetricFields: ['distanceKm', 'durationMin', 'elevationGain', 'rpe'],
      },
    ])
    .onConflictDoNothing()
    .run()

  console.log('✅ Realized-training fixtures initialized for Ana Acosta.')
  console.log('   • completed prescribed session with durable evidence')
  console.log('   • partial prescribed session with explicit unknown avg HR')
  console.log('   • expired prescribed session without realized evidence (missed candidate)')
  console.log('   • extra realized workout without an official session')
}

seedRealizedTrainingFixtures().catch((error) => {
  console.error('❌ Failed to initialize realized-training fixtures:', error)
  process.exitCode = 1
})
