import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { competitionEntries } from '@/db/competition-entry-schema'
import {
  competitionEntryRaceCourses,
  raceCourses,
  raceEditions,
  raceEvents,
  trainingGoalRaceCourses,
} from '@/db/race-catalog-schema'
import { macrocycles, trainingGoals } from '@/db/schema'
import { currentUser } from '@/data/data'
import type { RaceCourseClassification } from '@/types/training/race-catalog.types'

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

function getMondayFromISODate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return formatISODate(date)
}

function classification(
  systemId: string,
  authority: string,
  dimension: RaceCourseClassification['dimension'],
  versionRef: string,
  code: string,
  label: string,
): RaceCourseClassification {
  return {
    systemId,
    authority,
    dimension,
    versionRef,
    code,
    label,
    provenance: 'manual_reference',
    sourceUrl: null,
    assessedAt: getCurrentDateInArgentina(),
  }
}

async function seedRaceCatalog() {
  console.log('🏁 Poblando catálogo competitivo representativo...')

  const now = new Date().toISOString()
  const currentWeekStart = getMondayFromISODate(getCurrentDateInArgentina())
  const userId = String(currentUser.id || 'user_1')
  const athleteProfileId = `profile_${userId}`
  const trainingGoalId = `training_goal_${athleteProfileId}`

  const currentEditionStart = shiftISODate(currentWeekStart, 8 * 7)
  const currentEditionEnd = shiftISODate(currentEditionStart, 1)
  const nextEditionStart = shiftISODate(currentEditionStart, 365)
  const nextEditionEnd = shiftISODate(nextEditionStart, 1)
  const roadEditionDate = shiftISODate(currentWeekStart, 10 * 7)
  const verticalEditionDate = shiftISODate(currentWeekStart, 11 * 7)

  const eventRows = [
    {
      id: 'race_event_patagonia_demo',
      name: 'Patagonia Run Demo',
      websiteUrl: 'https://example.test/patagonia-run',
      description: 'Fixture multidistancia para walkthroughs del catálogo competitivo.',
      status: 'active' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_event_ciudad_demo',
      name: 'Ciudad 10K Demo',
      websiteUrl: null,
      description: 'Fixture de ruta para contrastar perfiles y modalidad.',
      status: 'active' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_event_vertical_demo',
      name: 'Vertical Demo',
      websiteUrl: null,
      description: 'Fixture explícito de kilómetro vertical; la modalidad no se infiere por densidad.',
      status: 'active' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
  ]

  await db.insert(raceEvents).values(eventRows).onConflictDoNothing().run()

  const currentYear = new Date(`${currentEditionStart}T00:00:00Z`).getUTCFullYear()
  const nextYear = new Date(`${nextEditionStart}T00:00:00Z`).getUTCFullYear()

  const editionRows = [
    {
      id: 'race_edition_patagonia_current',
      raceEventId: 'race_event_patagonia_demo',
      label: `Patagonia Run Demo ${currentYear}`,
      startDate: currentEditionStart,
      endDate: currentEditionEnd,
      organizerName: 'Organización Demo',
      location: { locality: 'San Martín de los Andes', region: 'Neuquén', countryCode: 'AR' },
      websiteUrl: null,
      notes: 'Edición activa para selección desde planning y TrainingGoal.',
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_edition_patagonia_next',
      raceEventId: 'race_event_patagonia_demo',
      label: `Patagonia Run Demo ${nextYear}`,
      startDate: nextEditionStart,
      endDate: nextEditionEnd,
      organizerName: 'Organización Demo',
      location: { locality: 'San Martín de los Andes', region: 'Neuquén', countryCode: 'AR' },
      websiteUrl: null,
      notes: 'Segunda edición para comprobar que cambios de recorrido no reescriben la edición anterior.',
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_edition_ciudad_current',
      raceEventId: 'race_event_ciudad_demo',
      label: `Ciudad 10K Demo ${currentYear}`,
      startDate: roadEditionDate,
      endDate: null,
      organizerName: 'Organización Demo',
      location: { locality: 'San Juan', region: 'San Juan', countryCode: 'AR' },
      websiteUrl: null,
      notes: null,
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_edition_vertical_current',
      raceEventId: 'race_event_vertical_demo',
      label: `Vertical Demo ${currentYear}`,
      startDate: verticalEditionDate,
      endDate: null,
      organizerName: 'Organización Demo',
      location: { locality: 'Barreal', region: 'San Juan', countryCode: 'AR' },
      websiteUrl: null,
      notes: null,
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
  ]

  await db.insert(raceEditions).values(editionRows).onConflictDoNothing().run()

  const courseRows = [
    {
      id: 'race_course_patagonia_12k',
      raceEditionId: 'race_edition_patagonia_current',
      label: '12K',
      distanceKm: 12,
      elevationGainM: 600,
      modality: { code: 'trail' as const },
      classifications: [
        classification('itra.distance_category', 'ITRA', 'distance_category', '2026-09-13', 'S', 'Short'),
      ],
      scheduledStartAt: `${currentEditionStart}T09:00:00-03:00`,
      startLocationLabel: 'San Martín de los Andes',
      notes: 'Recorrido trail corto y corrible.',
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_course_patagonia_21k_runnable',
      raceEditionId: 'race_edition_patagonia_current',
      label: '21K Corrible',
      distanceKm: 21,
      elevationGainM: 700,
      modality: { code: 'trail' as const },
      classifications: [],
      scheduledStartAt: `${currentEditionStart}T08:30:00-03:00`,
      startLocationLabel: 'San Martín de los Andes',
      notes: 'Misma distancia nominal que otro fixture, con menor D+.',
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_course_patagonia_21k_technical',
      raceEditionId: 'race_edition_patagonia_current',
      label: '21K Técnico',
      distanceKm: 21,
      elevationGainM: 1900,
      modality: { code: 'skyrunning' as const },
      classifications: [
        classification('isf.discipline', 'ISF', 'discipline', '2026-09-13', 'SKY', 'Sky'),
      ],
      scheduledStartAt: `${currentEditionStart}T07:30:00-03:00`,
      startLocationLabel: 'San Martín de los Andes',
      notes: 'Igual distancia nominal y perfil claramente distinto.',
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_course_patagonia_42k',
      raceEditionId: 'race_edition_patagonia_current',
      label: '42K',
      distanceKm: 42,
      elevationGainM: 1800,
      modality: { code: 'trail' as const },
      classifications: [
        classification('itra.distance_category', 'ITRA', 'distance_category', '2026-09-13', 'M', 'Medium'),
      ],
      scheduledStartAt: `${currentEditionEnd}T07:00:00-03:00`,
      startLocationLabel: 'San Martín de los Andes',
      notes: null,
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_course_patagonia_100k',
      raceEditionId: 'race_edition_patagonia_current',
      label: '100K Ultra',
      distanceKm: 100,
      elevationGainM: 5200,
      modality: { code: 'trail' as const },
      classifications: [
        classification('itra.distance_category', 'ITRA', 'distance_category', '2026-09-13', 'XL', 'Ultra'),
      ],
      scheduledStartAt: `${currentEditionEnd}T04:00:00-03:00`,
      startLocationLabel: 'San Martín de los Andes',
      notes: 'Fixture ultra; la clasificación es metadata versionada, no readiness.',
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_course_patagonia_tbd',
      raceEditionId: 'race_edition_patagonia_current',
      label: 'Recorrido por confirmar',
      distanceKm: null,
      elevationGainM: null,
      modality: null,
      classifications: [],
      scheduledStartAt: null,
      startLocationLabel: null,
      notes: 'Fixture deliberadamente incompleto: unknown no se reemplaza por cero.',
      status: 'draft' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_course_patagonia_next_42k',
      raceEditionId: 'race_edition_patagonia_next',
      label: '42K',
      distanceKm: 43.5,
      elevationGainM: 2200,
      modality: { code: 'trail' as const },
      classifications: [
        classification('itra.distance_category', 'ITRA', 'distance_category', '2026-09-13', 'M', 'Medium'),
      ],
      scheduledStartAt: `${nextEditionStart}T07:00:00-03:00`,
      startLocationLabel: 'San Martín de los Andes',
      notes: 'Nueva edición con mediciones distintas; no modifica el curso anterior.',
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_course_ciudad_10k',
      raceEditionId: 'race_edition_ciudad_current',
      label: '10K Ruta',
      distanceKm: 10,
      elevationGainM: 40,
      modality: { code: 'road' as const },
      classifications: [],
      scheduledStartAt: `${roadEditionDate}T08:00:00-03:00`,
      startLocationLabel: 'San Juan',
      notes: null,
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_course_vertical_vk',
      raceEditionId: 'race_edition_vertical_current',
      label: 'KV',
      distanceKm: 4.8,
      elevationGainM: 1000,
      modality: { code: 'vertical_kilometer' as const },
      classifications: [
        classification('isf.discipline', 'ISF', 'discipline', '2026-09-13', 'VERTICAL', 'Vertical'),
      ],
      scheduledStartAt: `${verticalEditionDate}T09:00:00-03:00`,
      startLocationLabel: 'Barreal',
      notes: 'La modalidad se declara explícitamente; no se deriva de m+/km.',
      status: 'published' as const,
      sourceOrigin: 'product' as const,
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
  ]

  await db.insert(raceCourses).values(courseRows).onConflictDoNothing().run()

  const competitionRows = [
    {
      id: 'competition_s2_catalog_a',
      groupTrainingPlanId: 'group_plan_s2_12k',
      name: 'Patagonia Run Demo — 12K',
      date: currentEditionStart,
      distanceKm: 12,
      elevationGainM: 600,
      priority: 'A' as const,
      status: 'confirmed' as const,
      description: 'Snapshot aceptado desde el catálogo; no depende de cambios live posteriores.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competition_s2_catalog_b',
      groupTrainingPlanId: 'group_plan_s2_12k',
      name: 'Patagonia Run Demo — 21K Corrible',
      date: currentEditionStart,
      distanceKm: 21,
      elevationGainM: 700,
      priority: 'B' as const,
      status: 'planned' as const,
      description: 'Competencia intermedia de demostración.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competition_m1_catalog_a',
      groupTrainingPlanId: 'group_plan_m1_42k',
      name: 'Patagonia Run Demo — 42K',
      date: currentEditionEnd,
      distanceKm: 42,
      elevationGainM: 1800,
      priority: 'A' as const,
      status: 'confirmed' as const,
      description: 'Snapshot principal M1 vinculado a RaceCourse.',
      createdAt: now,
      updatedAt: now,
    },
  ]

  await db.insert(competitionEntries).values(competitionRows).onConflictDoNothing().run()

  await db.insert(competitionEntryRaceCourses).values([
    {
      competitionEntryId: 'competition_s2_catalog_a',
      raceCourseId: 'race_course_patagonia_12k',
      createdAt: now,
    },
    {
      competitionEntryId: 'competition_s2_catalog_b',
      raceCourseId: 'race_course_patagonia_21k_runnable',
      createdAt: now,
    },
    {
      competitionEntryId: 'competition_m1_catalog_a',
      raceCourseId: 'race_course_patagonia_42k',
      createdAt: now,
    },
  ]).onConflictDoNothing().run()

  await db.update(trainingGoals).set({
    title: 'Patagonia Run Demo — 12K',
    description: 'Objetivo individual seleccionado desde el catálogo competitivo.',
    targetDate: currentEditionStart,
    raceName: 'Patagonia Run Demo — 12K',
    raceDistanceKm: 12,
    raceElevationGain: 600,
    updatedAt: now,
  }).where(eq(trainingGoals.id, trainingGoalId)).run()

  await db.insert(trainingGoalRaceCourses).values({
    trainingGoalId,
    raceCourseId: 'race_course_patagonia_12k',
    createdAt: now,
  }).onConflictDoNothing().run()

  await db.update(macrocycles).set({
    targetRaceName: 'Patagonia Run Demo — 12K',
    targetRaceDate: currentEditionStart,
    targetRaceDistanceKm: 12,
    targetRaceElevationGain: 600,
    updatedAt: now,
  }).where(eq(macrocycles.id, 'macro_s2_12k')).run()

  await db.update(macrocycles).set({
    targetRaceName: 'Patagonia Run Demo — 42K',
    targetRaceDate: currentEditionEnd,
    targetRaceDistanceKm: 42,
    targetRaceElevationGain: 1800,
    updatedAt: now,
  }).where(eq(macrocycles.id, 'macro_m1_42k')).run()

  console.log('✅ Catálogo competitivo demo inicializado correctamente.')
  console.log('   • Patagonia Run Demo: 2 ediciones, multidistancia y perfil desconocido')
  console.log('   • Perfiles: trail corrible/técnico, ultra, ruta y kilómetro vertical')
  console.log('   • CompetitionEntry S2/M1 vinculadas con snapshots históricos')
  console.log('   • TrainingGoal del atleta actual vinculado a RaceCourse sin crear inscripción')
}

seedRaceCatalog().catch((error) => {
  console.error('❌ Error al poblar catálogo competitivo:', error)
  process.exitCode = 1
})
