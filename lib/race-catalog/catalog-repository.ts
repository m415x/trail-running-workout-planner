import { randomUUID } from 'node:crypto'
import { and, asc, eq, like, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  competitionEntryRaceCourses,
  raceCourses,
  raceEditions,
  raceEvents,
  trainingGoalRaceCourses,
} from '@/db/race-catalog-schema'
import type {
  RaceCatalogRecordProvenance,
  RaceCourse,
  RaceCourseClassification,
  RaceCourseModality,
  RaceCourseReference,
  RaceCourseStatus,
  RaceEdition,
  RaceEditionLocation,
  RaceEditionStatus,
  RaceEvent,
  RaceEventStatus,
} from '@/types/training/race-catalog.types'

interface SourceInput {
  origin?: RaceCatalogRecordProvenance['origin']
  provider?: string | null
  externalId?: string | null
  sourceUrl?: string | null
}

export interface CreateRaceEventInput {
  name: string
  websiteUrl?: string | null
  description?: string | null
  status?: RaceEventStatus
  source?: SourceInput
}

export type UpdateRaceEventInput = Partial<Omit<CreateRaceEventInput, 'source'>> & {
  source?: SourceInput
}

export interface CreateRaceEditionInput {
  raceEventId: string
  label: string
  startDate: string
  endDate?: string | null
  organizerName?: string | null
  location?: RaceEditionLocation | null
  websiteUrl?: string | null
  notes?: string | null
  status?: RaceEditionStatus
  source?: SourceInput
}

export type UpdateRaceEditionInput = Partial<Omit<CreateRaceEditionInput, 'raceEventId' | 'source'>> & {
  source?: SourceInput
}

export interface CreateRaceCourseInput {
  raceEditionId: string
  label: string
  distanceKm?: number | null
  elevationGainM?: number | null
  modality?: RaceCourseModality | null
  classifications?: readonly RaceCourseClassification[]
  scheduledStartAt?: string | null
  startLocationLabel?: string | null
  notes?: string | null
  status?: RaceCourseStatus
  source?: SourceInput
}

export type UpdateRaceCourseInput = Partial<Omit<CreateRaceCourseInput, 'raceEditionId' | 'source'>> & {
  source?: SourceInput
}

export interface RaceCourseSearchInput {
  query?: string
  raceEventId?: string
  fromDate?: string
  toDate?: string
  selectableOnly?: boolean
  limit?: number
}

export interface RaceCourseSearchResult {
  event: RaceEvent
  edition: RaceEdition
  course: RaceCourse
}

function normalizeSource(source?: SourceInput) {
  const origin = source?.origin ?? 'product'
  const provider = source?.provider?.trim() || null
  const externalId = source?.externalId?.trim() || null
  const sourceUrl = source?.sourceUrl?.trim() || null

  if (origin === 'external' && (!provider || !externalId)) {
    throw new Error('External catalog records require source provider and external id')
  }

  return { sourceOrigin: origin, sourceProvider: provider, externalId, sourceUrl }
}

function mapSource(row: {
  sourceOrigin: RaceCatalogRecordProvenance['origin']
  sourceProvider: string | null
  externalId: string | null
  sourceUrl: string | null
}): RaceCatalogRecordProvenance {
  return {
    origin: row.sourceOrigin,
    provider: row.sourceProvider,
    externalId: row.externalId,
    sourceUrl: row.sourceUrl,
  }
}

function mapEvent(row: typeof raceEvents.$inferSelect): RaceEvent {
  return {
    id: row.id,
    isDeleted: row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    name: row.name,
    websiteUrl: row.websiteUrl,
    description: row.description,
    status: row.status,
    source: mapSource(row),
  }
}

function mapEdition(row: typeof raceEditions.$inferSelect): RaceEdition {
  return {
    id: row.id,
    isDeleted: row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    raceEventId: row.raceEventId,
    label: row.label,
    startDate: row.startDate,
    endDate: row.endDate,
    organizerName: row.organizerName,
    location: row.location,
    websiteUrl: row.websiteUrl,
    notes: row.notes,
    status: row.status,
    source: mapSource(row),
  }
}

function mapCourse(row: typeof raceCourses.$inferSelect): RaceCourse {
  return {
    id: row.id,
    isDeleted: row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    raceEditionId: row.raceEditionId,
    label: row.label,
    distanceKm: row.distanceKm,
    elevationGainM: row.elevationGainM,
    modality: row.modality,
    classifications: row.classifications,
    scheduledStartAt: row.scheduledStartAt,
    startLocationLabel: row.startLocationLabel,
    notes: row.notes,
    status: row.status,
    source: mapSource(row),
  }
}

function now() {
  return new Date().toISOString()
}

function assertDateOrder(startDate: string, endDate?: string | null) {
  if (endDate && endDate < startDate) {
    throw new Error('Race edition end date cannot precede start date')
  }
}

function assertCourseMetrics(distanceKm?: number | null, elevationGainM?: number | null) {
  if (distanceKm !== undefined && distanceKm !== null && (!Number.isFinite(distanceKm) || distanceKm <= 0)) {
    throw new Error('Race course distance must be greater than zero when known')
  }
  if (
    elevationGainM !== undefined
    && elevationGainM !== null
    && (!Number.isFinite(elevationGainM) || elevationGainM < 0)
  ) {
    throw new Error('Race course elevation gain cannot be negative when known')
  }
}

export function getRaceEvent(id: string): RaceEvent | null {
  const row = db.select().from(raceEvents).where(eq(raceEvents.id, id)).get()
  return row ? mapEvent(row) : null
}

export function getRaceEdition(id: string): RaceEdition | null {
  const row = db.select().from(raceEditions).where(eq(raceEditions.id, id)).get()
  return row ? mapEdition(row) : null
}

export function getRaceCourse(id: string): RaceCourse | null {
  const row = db.select().from(raceCourses).where(eq(raceCourses.id, id)).get()
  return row ? mapCourse(row) : null
}

export function createRaceEvent(input: CreateRaceEventInput): RaceEvent {
  const name = input.name.trim()
  if (!name) throw new Error('Race event name is required')

  const timestamp = now()
  const id = randomUUID()
  db.insert(raceEvents).values({
    id,
    name,
    websiteUrl: input.websiteUrl?.trim() || null,
    description: input.description?.trim() || null,
    status: input.status ?? 'active',
    ...normalizeSource(input.source),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return getRaceEvent(id)!
}

export function updateRaceEvent(id: string, input: UpdateRaceEventInput): RaceEvent {
  const existing = getRaceEvent(id)
  if (!existing || existing.isDeleted) throw new Error('Race event not found')

  if (input.name !== undefined && !input.name.trim()) throw new Error('Race event name is required')

  db.update(raceEvents).set({
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl?.trim() || null } : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.source !== undefined ? normalizeSource(input.source) : {}),
    updatedAt: now(),
  }).where(eq(raceEvents.id, id)).run()

  return getRaceEvent(id)!
}

export function softDeleteRaceEvent(id: string) {
  db.update(raceEvents).set({ isDeleted: true, updatedAt: now() }).where(eq(raceEvents.id, id)).run()
}

export function createRaceEdition(input: CreateRaceEditionInput): RaceEdition {
  const event = getRaceEvent(input.raceEventId)
  if (!event || event.isDeleted) throw new Error('Parent race event not found')
  const label = input.label.trim()
  if (!label) throw new Error('Race edition label is required')
  assertDateOrder(input.startDate, input.endDate)

  const timestamp = now()
  const id = randomUUID()
  db.insert(raceEditions).values({
    id,
    raceEventId: input.raceEventId,
    label,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    organizerName: input.organizerName?.trim() || null,
    location: input.location ?? null,
    websiteUrl: input.websiteUrl?.trim() || null,
    notes: input.notes?.trim() || null,
    status: input.status ?? 'draft',
    ...normalizeSource(input.source),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return getRaceEdition(id)!
}

export function updateRaceEdition(id: string, input: UpdateRaceEditionInput): RaceEdition {
  const existing = getRaceEdition(id)
  if (!existing || existing.isDeleted) throw new Error('Race edition not found')
  if (input.label !== undefined && !input.label.trim()) throw new Error('Race edition label is required')

  const startDate = input.startDate ?? existing.startDate
  const endDate = input.endDate !== undefined ? input.endDate : existing.endDate
  assertDateOrder(startDate, endDate)

  db.update(raceEditions).set({
    ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    ...(input.organizerName !== undefined ? { organizerName: input.organizerName?.trim() || null } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl?.trim() || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.source !== undefined ? normalizeSource(input.source) : {}),
    updatedAt: now(),
  }).where(eq(raceEditions.id, id)).run()

  return getRaceEdition(id)!
}

export function softDeleteRaceEdition(id: string) {
  db.update(raceEditions).set({ isDeleted: true, updatedAt: now() }).where(eq(raceEditions.id, id)).run()
}

export function createRaceCourse(input: CreateRaceCourseInput): RaceCourse {
  const edition = getRaceEdition(input.raceEditionId)
  if (!edition || edition.isDeleted) throw new Error('Parent race edition not found')
  const label = input.label.trim()
  if (!label) throw new Error('Race course label is required')
  assertCourseMetrics(input.distanceKm, input.elevationGainM)

  const timestamp = now()
  const id = randomUUID()
  db.insert(raceCourses).values({
    id,
    raceEditionId: input.raceEditionId,
    label,
    distanceKm: input.distanceKm ?? null,
    elevationGainM: input.elevationGainM ?? null,
    modality: input.modality ?? null,
    classifications: [...(input.classifications ?? [])],
    scheduledStartAt: input.scheduledStartAt ?? null,
    startLocationLabel: input.startLocationLabel?.trim() || null,
    notes: input.notes?.trim() || null,
    status: input.status ?? 'draft',
    ...normalizeSource(input.source),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return getRaceCourse(id)!
}

export function updateRaceCourse(id: string, input: UpdateRaceCourseInput): RaceCourse {
  const existing = getRaceCourse(id)
  if (!existing || existing.isDeleted) throw new Error('Race course not found')
  if (input.label !== undefined && !input.label.trim()) throw new Error('Race course label is required')
  assertCourseMetrics(input.distanceKm, input.elevationGainM)

  db.update(raceCourses).set({
    ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    ...(input.distanceKm !== undefined ? { distanceKm: input.distanceKm } : {}),
    ...(input.elevationGainM !== undefined ? { elevationGainM: input.elevationGainM } : {}),
    ...(input.modality !== undefined ? { modality: input.modality } : {}),
    ...(input.classifications !== undefined ? { classifications: [...input.classifications] } : {}),
    ...(input.scheduledStartAt !== undefined ? { scheduledStartAt: input.scheduledStartAt } : {}),
    ...(input.startLocationLabel !== undefined
      ? { startLocationLabel: input.startLocationLabel?.trim() || null }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.source !== undefined ? normalizeSource(input.source) : {}),
    updatedAt: now(),
  }).where(eq(raceCourses.id, id)).run()

  return getRaceCourse(id)!
}

export function softDeleteRaceCourse(id: string) {
  db.update(raceCourses).set({ isDeleted: true, updatedAt: now() }).where(eq(raceCourses.id, id)).run()
}

export function getRaceCourseReference(raceCourseId: string): RaceCourseReference | null {
  const row = db
    .select({
      raceEventId: raceEvents.id,
      raceEditionId: raceEditions.id,
      raceCourseId: raceCourses.id,
    })
    .from(raceCourses)
    .innerJoin(raceEditions, eq(raceCourses.raceEditionId, raceEditions.id))
    .innerJoin(raceEvents, eq(raceEditions.raceEventId, raceEvents.id))
    .where(eq(raceCourses.id, raceCourseId))
    .get()

  return row ?? null
}

export function searchRaceCourses(input: RaceCourseSearchInput = {}): RaceCourseSearchResult[] {
  const conditions = [
    eq(raceEvents.isDeleted, false),
    eq(raceEditions.isDeleted, false),
    eq(raceCourses.isDeleted, false),
  ]

  const query = input.query?.trim()
  if (query) {
    const pattern = `%${query}%`
    conditions.push(or(
      like(raceEvents.name, pattern),
      like(raceEditions.label, pattern),
      like(raceCourses.label, pattern),
    )!)
  }
  if (input.raceEventId) conditions.push(eq(raceEvents.id, input.raceEventId))
  if (input.fromDate) conditions.push(sql`${raceEditions.startDate} >= ${input.fromDate}`)
  if (input.toDate) conditions.push(sql`${raceEditions.startDate} <= ${input.toDate}`)
  if (input.selectableOnly) {
    conditions.push(eq(raceEvents.status, 'active'))
    conditions.push(eq(raceEditions.status, 'published'))
    conditions.push(eq(raceCourses.status, 'published'))
    conditions.push(sql`${raceCourses.distanceKm} is not null`)
  }

  const rows = db
    .select({ event: raceEvents, edition: raceEditions, course: raceCourses })
    .from(raceCourses)
    .innerJoin(raceEditions, eq(raceCourses.raceEditionId, raceEditions.id))
    .innerJoin(raceEvents, eq(raceEditions.raceEventId, raceEvents.id))
    .where(and(...conditions))
    .orderBy(asc(raceEditions.startDate), asc(raceEvents.name), asc(raceCourses.label))
    .limit(Math.min(Math.max(input.limit ?? 50, 1), 200))
    .all()

  return rows.map((row) => ({
    event: mapEvent(row.event),
    edition: mapEdition(row.edition),
    course: mapCourse(row.course),
  }))
}

export function linkCompetitionEntryToRaceCourse(competitionEntryId: string, raceCourseId: string) {
  db.insert(competitionEntryRaceCourses)
    .values({ competitionEntryId, raceCourseId, createdAt: now() })
    .onConflictDoUpdate({
      target: competitionEntryRaceCourses.competitionEntryId,
      set: { raceCourseId, createdAt: now() },
    })
    .run()
}

export function linkTrainingGoalToRaceCourse(trainingGoalId: string, raceCourseId: string) {
  db.insert(trainingGoalRaceCourses)
    .values({ trainingGoalId, raceCourseId, createdAt: now() })
    .onConflictDoUpdate({
      target: trainingGoalRaceCourses.trainingGoalId,
      set: { raceCourseId, createdAt: now() },
    })
    .run()
}
