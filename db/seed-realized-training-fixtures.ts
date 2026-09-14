import { and, eq, gte, isNull, lte } from 'drizzle-orm'

import { db } from '@/db/index'
import { workoutLogEvidence } from '@/db/readiness-schema'
import {
  athleteProfiles,
  groupSessionPrescriptions,
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
  sessions,
  workoutLogs,
} from '@/db/schema'

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
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

async function seedRealizedTrainingFixtures() {
  console.log('🏃 Seeding realized-training walkthrough fixtures...')

  const athlete = await db
    .select({ id: athleteProfiles.id, groupId: athleteProfiles.groupId })
    .from(athleteProfiles)
    .where(and(eq(athleteProfiles.id, ATHLETE_ID), eq(athleteProfiles.teamId, TEAM_ID)))
    .get()

  if (!athlete) {
    throw new Error('Run `pn db:seed:base` first: the Ana Acosta fixture is required.')
  }

  if (!athlete.groupId) {
    throw new Error('Ana Acosta must belong to a sporting group for prescribed fixtures.')
  }

  const today = getCurrentDateInArgentina()
  const fixtureWeekStart = shiftISODate(getMondayFromISODate(today), -7)
  const completedDate = shiftISODate(fixtureWeekStart, 1)
  const partialDate = shiftISODate(fixtureWeekStart, 2)
  const missedDate = shiftISODate(fixtureWeekStart, 3)
  const extraDate = shiftISODate(fixtureWeekStart, 4)
  const now = new Date().toISOString()

  const historicalPlanId = `${FIXTURE_PREFIX}plan`
  const historicalMacrocycleId = `${FIXTURE_PREFIX}macrocycle`
  const historicalMesocycleId = `${FIXTURE_PREFIX}mesocycle`
  const historicalMicrocycleId = `${FIXTURE_PREFIX}microcycle`
  const fixtureWeekEnd = shiftISODate(fixtureWeekStart, 6)

  await db.insert(groupTrainingPlans).values({
    id: historicalPlanId,
    groupId: athlete.groupId,
    planningCohortId: null,
    sourceGroupTrainingPlanId: null,
    title: 'KAN-297 — Historical realized-training walkthrough',
    status: 'active',
    notes: 'Isolated historical plan for the realized-training walkthrough fixtures.',
  }).onConflictDoUpdate({
    target: groupTrainingPlans.id,
    set: { groupId: athlete.groupId, status: 'active' },
  }).run()

  await db.insert(macrocycles).values({
    id: historicalMacrocycleId,
    title: 'KAN-297 — Historical walkthrough week',
    groupTrainingPlanId: historicalPlanId,
    startDate: fixtureWeekStart,
    endDate: fixtureWeekEnd,
    taperingWeeksCount: 0,
    targetRaceName: null,
    targetRaceDate: null,
    targetRaceDistanceKm: null,
    targetRaceElevationGain: null,
    notes: null,
  }).onConflictDoUpdate({
    target: macrocycles.id,
    set: { startDate: fixtureWeekStart, endDate: fixtureWeekEnd },
  }).run()

  await db.insert(mesocycles).values({
    id: historicalMesocycleId,
    macrocycleId: historicalMacrocycleId,
    title: 'KAN-297 — Historical walkthrough block',
    number: 1,
    period: 'specific_preparatory',
    objective: 'Validate prescribed and realized day-state projection.',
  }).onConflictDoUpdate({
    target: mesocycles.id,
    set: { macrocycleId: historicalMacrocycleId },
  }).run()

  await db.insert(microcycles).values({
    id: historicalMicrocycleId,
    mesocycleId: historicalMesocycleId,
    weekNumber: 1,
    type: 'development',
    startDate: fixtureWeekStart,
    endDate: fixtureWeekEnd,
    targetVolumeKm: 24,
    targetVolumeSource: 'generated',
    targetElevationGain: 840,
    targetElevationSource: 'generated',
    targetDurationMin: null,
    notes: 'Dedicated past week for a stable walkthrough regardless of the current weekday.',
  }).onConflictDoUpdate({
    target: microcycles.id,
    set: { startDate: fixtureWeekStart, endDate: fixtureWeekEnd },
  }).run()

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

  async function resolveBaseMicrocycle(date: string) {
    const row = await db
      .select({ id: microcycles.id })
      .from(microcycles)
      .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
      .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
      .innerJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
      .where(and(
        eq(groupTrainingPlans.groupId, athlete.groupId!),
        isNull(groupTrainingPlans.planningCohortId),
        lte(microcycles.startDate, date),
        gte(microcycles.endDate, date),
        eq(microcycles.isDeleted, false),
        eq(mesocycles.isDeleted, false),
        eq(macrocycles.isDeleted, false),
        eq(groupTrainingPlans.isDeleted, false),
      ))
      .get()

    if (!row) throw new Error(`No applicable base-plan microcycle found for ${date}.`)
    return row.id
  }

  const prescribedFixtures = [
    {
      id: `${FIXTURE_PREFIX}prescription_completed`,
      sessionId: `${FIXTURE_PREFIX}session_completed`,
      date: completedDate,
      distanceKm: 8,
      durationMin: 53,
      elevationGain: 320,
    },
    {
      id: `${FIXTURE_PREFIX}prescription_partial`,
      sessionId: `${FIXTURE_PREFIX}session_partial`,
      date: partialDate,
      distanceKm: 8,
      durationMin: 55,
      elevationGain: 300,
    },
    {
      id: `${FIXTURE_PREFIX}prescription_missed`,
      sessionId: `${FIXTURE_PREFIX}session_missed`,
      date: missedDate,
      distanceKm: 7,
      durationMin: 48,
      elevationGain: 220,
    },
  ]

  for (const fixture of prescribedFixtures) {
    const prescription = {
      id: fixture.id,
      sessionId: fixture.sessionId,
      groupId: athlete.groupId,
      microcycleId: await resolveBaseMicrocycle(fixture.date),
      distanceKm: fixture.distanceKm,
      durationMin: fixture.durationMin,
      elevationGain: fixture.elevationGain,
      intensityMethod: null,
      zone: null,
      pamPercentage: null,
      notes: 'KAN-297 walkthrough prescription.',
      generationOwnership: 'manual' as const,
      generationKey: null,
    }
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
