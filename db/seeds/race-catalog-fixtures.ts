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

function currentDateArgentina() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function currentMonday() {
  const date = new Date(`${currentDateArgentina()}T00:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return formatISODate(date)
}

function classification(
  systemId: string,
  authority: string,
  dimension: RaceCourseClassification['dimension'],
  code: string,
  label: string,
): RaceCourseClassification {
  return {
    systemId,
    authority,
    dimension,
    versionRef: '2026-09-13',
    code,
    label,
    provenance: 'manual_reference',
    sourceUrl: null,
    assessedAt: currentDateArgentina(),
  }
}

async function seedRaceCatalogFixtures() {
  console.log('🏁 Poblando fixtures representativos del catálogo competitivo...')

  const now = new Date().toISOString()
  const weekStart = currentMonday()
  const editionStart = shiftISODate(weekStart, 8 * 7)
  const editionEnd = shiftISODate(editionStart, 1)
  const nextEditionStart = shiftISODate(editionStart, 365)
  const nextEditionEnd = shiftISODate(nextEditionStart, 1)
  const roadDate = shiftISODate(weekStart, 10 * 7)
  const verticalDate = shiftISODate(weekStart, 11 * 7)
  const year = new Date(`${editionStart}T00:00:00Z`).getUTCFullYear()
  const nextYear = new Date(`${nextEditionStart}T00:00:00Z`).getUTCFullYear()

  await db.insert(raceEvents).values([
    {
      id: 'race_event_patagonia_demo',
      name: 'Patagonia Run Demo',
      websiteUrl: 'https://example.test/patagonia-run',
      description: 'Evento multidistancia de demo para walkthroughs.',
      status: 'active',
      sourceOrigin: 'product',
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
      description: 'Perfil de ruta de referencia.',
      status: 'active',
      sourceOrigin: 'product',
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
      description: 'Kilómetro vertical explícito; la modalidad no se infiere del D+.',
      status: 'active',
      sourceOrigin: 'product',
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
  ]).onConflictDoNothing().run()

  await db.insert(raceEditions).values([
    {
      id: 'race_edition_patagonia_current',
      raceEventId: 'race_event_patagonia_demo',
      label: `Patagonia Run Demo ${year}`,
      startDate: editionStart,
      endDate: editionEnd,
      organizerName: 'Organización Demo',
      location: { locality: 'San Martín de los Andes', region: 'Neuquén', countryCode: 'AR' },
      websiteUrl: null,
      notes: 'Edición activa de demo.',
      status: 'published',
      sourceOrigin: 'product',
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
      notes: 'Segunda edición con recorrido modificado.',
      status: 'published',
      sourceOrigin: 'product',
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_edition_ciudad_current',
      raceEventId: 'race_event_ciudad_demo',
      label: `Ciudad 10K Demo ${year}`,
      startDate: roadDate,
      endDate: null,
      organizerName: 'Organización Demo',
      location: { locality: 'San Juan', region: 'San Juan', countryCode: 'AR' },
      websiteUrl: null,
      notes: null,
      status: 'published',
      sourceOrigin: 'product',
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'race_edition_vertical_current',
      raceEventId: 'race_event_vertical_demo',
      label: `Vertical Demo ${year}`,
      startDate: verticalDate,
      endDate: null,
      organizerName: 'Organización Demo',
      location: { locality: 'Barreal', region: 'San Juan', countryCode: 'AR' },
      websiteUrl: null,
      notes: null,
      status: 'published',
      sourceOrigin: 'product',
      sourceProvider: null,
      externalId: null,
      sourceUrl: null,
      createdAt: now,
      updatedAt: now,
    },
  ]).onConflictDoNothing().run()

  await db.insert(raceCourses).values([
    {
      id: 'race_course_patagonia_12k', raceEditionId: 'race_edition_patagonia_current', label: '12K',
      distanceKm: 12, elevationGainM: 600, modality: { code: 'trail' },
      classifications: [classification('itra.distance_category', 'ITRA', 'distance_category', '10K', '10K')],
      scheduledStartAt: `${editionStart}T09:00:00-03:00`, startLocationLabel: 'San Martín de los Andes',
      notes: 'Trail corto y corrible.', status: 'published', sourceOrigin: 'product', sourceProvider: null,
      externalId: null, sourceUrl: null, createdAt: now, updatedAt: now,
    },
    {
      id: 'race_course_patagonia_21k_runnable', raceEditionId: 'race_edition_patagonia_current', label: '21K Corrible',
      distanceKm: 21, elevationGainM: 700, modality: { code: 'trail' },
      classifications: [classification('itra.distance_category', 'ITRA', 'distance_category', 'Half Marathon', 'Half Marathon')],
      scheduledStartAt: `${editionStart}T08:30:00-03:00`, startLocationLabel: 'San Martín de los Andes',
      notes: 'Misma distancia nominal que el recorrido técnico, con menor D+.', status: 'published', sourceOrigin: 'product',
      sourceProvider: null, externalId: null, sourceUrl: null, createdAt: now, updatedAt: now,
    },
    {
      id: 'race_course_patagonia_21k_technical', raceEditionId: 'race_edition_patagonia_current', label: '21K Técnico',
      distanceKm: 21, elevationGainM: 1900, modality: { code: 'skyrunning' },
      classifications: [
        classification('itra.distance_category', 'ITRA', 'distance_category', 'Half Marathon', 'Half Marathon'),
        classification('isf.discipline', 'ISF', 'discipline', 'SKY', 'SKY'),
      ],
      scheduledStartAt: `${editionStart}T07:30:00-03:00`, startLocationLabel: 'San Martín de los Andes',
      notes: 'Igual distancia nominal y perfil/D+ claramente distintos.', status: 'published', sourceOrigin: 'product',
      sourceProvider: null, externalId: null, sourceUrl: null, createdAt: now, updatedAt: now,
    },
    {
      id: 'race_course_patagonia_42k', raceEditionId: 'race_edition_patagonia_current', label: '42K',
      distanceKm: 42, elevationGainM: 1800, modality: { code: 'trail' },
      classifications: [classification('itra.distance_category', 'ITRA', 'distance_category', 'Marathon', 'Marathon')],
      scheduledStartAt: `${editionEnd}T07:00:00-03:00`, startLocationLabel: 'San Martín de los Andes',
      notes: null, status: 'published', sourceOrigin: 'product', sourceProvider: null,
      externalId: null, sourceUrl: null, createdAt: now, updatedAt: now,
    },
    {
      id: 'race_course_patagonia_100k', raceEditionId: 'race_edition_patagonia_current', label: '100K Ultra',
      distanceKm: 100, elevationGainM: 5200, modality: { code: 'trail' },
      classifications: [classification('itra.distance_category', 'ITRA', 'distance_category', '100K', '100K')],
      scheduledStartAt: `${editionEnd}T04:00:00-03:00`, startLocationLabel: 'San Martín de los Andes',
      notes: 'Clasificación versionada; no implica readiness.', status: 'published', sourceOrigin: 'product',
      sourceProvider: null, externalId: null, sourceUrl: null, createdAt: now, updatedAt: now,
    },
    {
      id: 'race_course_patagonia_tbd', raceEditionId: 'race_edition_patagonia_current', label: 'Recorrido por confirmar',
      distanceKm: null, elevationGainM: null, modality: null, classifications: [],
      scheduledStartAt: null, startLocationLabel: null,
      notes: 'Fixture incompleto: unknown se conserva como null y nunca como cero.', status: 'draft', sourceOrigin: 'product',
      sourceProvider: null, externalId: null, sourceUrl: null, createdAt: now, updatedAt: now,
    },
    {
      id: 'race_course_patagonia_next_42k', raceEditionId: 'race_edition_patagonia_next', label: '42K',
      distanceKm: 43.5, elevationGainM: 2200, modality: { code: 'trail' },
      classifications: [classification('itra.distance_category', 'ITRA', 'distance_category', 'Marathon', 'Marathon')],
      scheduledStartAt: `${nextEditionStart}T07:00:00-03:00`, startLocationLabel: 'San Martín de los Andes',
      notes: 'Nueva edición con mediciones distintas; no modifica la anterior.', status: 'published', sourceOrigin: 'product',
      sourceProvider: null, externalId: null, sourceUrl: null, createdAt: now, updatedAt: now,
    },
    {
      id: 'race_course_ciudad_10k', raceEditionId: 'race_edition_ciudad_current', label: '10K Ruta',
      distanceKm: 10, elevationGainM: 40, modality: { code: 'road' }, classifications: [],
      scheduledStartAt: `${roadDate}T08:00:00-03:00`, startLocationLabel: 'San Juan', notes: null,
      status: 'published', sourceOrigin: 'product', sourceProvider: null, externalId: null, sourceUrl: null,
      createdAt: now, updatedAt: now,
    },
    {
      id: 'race_course_vertical_vk', raceEditionId: 'race_edition_vertical_current', label: 'KV',
      distanceKm: 4.8, elevationGainM: 1000, modality: { code: 'vertical_kilometer' },
      classifications: [classification('isf.discipline', 'ISF', 'discipline', 'VERTICAL', 'VERTICAL')],
      scheduledStartAt: `${verticalDate}T09:00:00-03:00`, startLocationLabel: 'Barreal',
      notes: 'La modalidad se declara explícitamente; no se deriva de m+/km.', status: 'published', sourceOrigin: 'product',
      sourceProvider: null, externalId: null, sourceUrl: null, createdAt: now, updatedAt: now,
    },
  ]).onConflictDoNothing().run()

  await db.insert(competitionEntries).values([
    {
      id: 'competition_s2_catalog_a', groupTrainingPlanId: 'group_plan_s2_12k', name: 'Patagonia Run Demo — 12K',
      date: editionStart, distanceKm: 12, elevationGainM: 600, priority: 'A', status: 'confirmed',
      description: 'Snapshot aceptado desde catálogo; no depende de cambios live.', createdAt: now, updatedAt: now,
    },
    {
      id: 'competition_s2_catalog_b', groupTrainingPlanId: 'group_plan_s2_12k', name: 'Patagonia Run Demo — 21K Corrible',
      date: editionStart, distanceKm: 21, elevationGainM: 700, priority: 'B', status: 'planned',
      description: 'Competencia intermedia de demo.', createdAt: now, updatedAt: now,
    },
    {
      id: 'competition_m1_catalog_a', groupTrainingPlanId: 'group_plan_m1_42k', name: 'Patagonia Run Demo — 42K',
      date: editionEnd, distanceKm: 42, elevationGainM: 1800, priority: 'A', status: 'confirmed',
      description: 'Snapshot principal M1 vinculado a RaceCourse.', createdAt: now, updatedAt: now,
    },
  ]).onConflictDoNothing().run()

  await db.insert(competitionEntryRaceCourses).values([
    { competitionEntryId: 'competition_s2_catalog_a', raceCourseId: 'race_course_patagonia_12k', createdAt: now },
    { competitionEntryId: 'competition_s2_catalog_b', raceCourseId: 'race_course_patagonia_21k_runnable', createdAt: now },
    { competitionEntryId: 'competition_m1_catalog_a', raceCourseId: 'race_course_patagonia_42k', createdAt: now },
  ]).onConflictDoNothing().run()

  const userId = String(currentUser.id || 'user_1')
  const trainingGoalId = `training_goal_profile_${userId}`

  await db.update(trainingGoals).set({
    title: 'Patagonia Run Demo — 12K',
    description: 'Objetivo individual seleccionado desde el catálogo competitivo.',
    targetDate: editionStart,
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
    targetRaceName: 'Patagonia Run Demo — 12K', targetRaceDate: editionStart,
    targetRaceDistanceKm: 12, targetRaceElevationGain: 600, updatedAt: now,
  }).where(eq(macrocycles.id, 'macro_s2_12k')).run()

  await db.update(macrocycles).set({
    targetRaceName: 'Patagonia Run Demo — 42K', targetRaceDate: editionEnd,
    targetRaceDistanceKm: 42, targetRaceElevationGain: 1800, updatedAt: now,
  }).where(eq(macrocycles.id, 'macro_m1_42k')).run()

  console.log('✅ Fixtures del catálogo competitivo inicializados correctamente.')
  console.log('   • Evento multidistancia + segunda edición con perfil modificado')
  console.log('   • Trail corrible/técnico, ultra, ruta, vertical y un perfil unknown')
  console.log('   • CompetitionEntry con snapshots + vínculos opcionales a RaceCourse')
  console.log('   • TrainingGoal vinculado sin implicar RaceRegistration')
}

seedRaceCatalogFixtures().catch((error) => {
  console.error('❌ Error al poblar fixtures del catálogo competitivo:', error)
  process.exitCode = 1
})
