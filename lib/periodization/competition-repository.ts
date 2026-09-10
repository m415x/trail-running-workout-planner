import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { competitionEntries } from '@/db/competition-entry-schema'
import type {
  CompetitionEntry,
  CompetitionEntryDraft,
  CompetitionStatus,
} from '@/types/training/competition-entry.types'

type CompetitionDatabase = typeof db

export interface CreateCompetitionRecord {
  readonly id: string
  readonly draft: CompetitionEntryDraft
  readonly createdAt: string
}

export interface UpdateCompetitionRecord {
  readonly id: string
  readonly draft: CompetitionEntryDraft
  readonly updatedAt: string
}

/** Lists non-deleted competition entries for one owning plan in date order. */
export function listCompetitionsByPlan(
  groupTrainingPlanId: string,
  database: CompetitionDatabase = db,
): CompetitionEntry[] {
  return database.query.competitionEntries.findMany({
    where: and(
      eq(competitionEntries.groupTrainingPlanId, groupTrainingPlanId),
      eq(competitionEntries.isDeleted, false),
    ),
    orderBy: [asc(competitionEntries.date), asc(competitionEntries.name)],
  }).sync()
}

/** Gets one visible competition entry by id. */
export function getCompetitionById(
  id: string,
  database: CompetitionDatabase = db,
): CompetitionEntry | null {
  return database.query.competitionEntries.findFirst({
    where: and(
      eq(competitionEntries.id, id),
      eq(competitionEntries.isDeleted, false),
    ),
  }).sync() ?? null
}

/** Persists one already-validated competition draft. */
export function createCompetitionRecord(
  input: CreateCompetitionRecord,
  database: CompetitionDatabase = db,
): CompetitionEntry {
  const record = {
    id: input.id,
    ...input.draft,
    elevationGainM: input.draft.elevationGainM ?? null,
    description: input.draft.description ?? null,
    isDeleted: false,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  }

  database.insert(competitionEntries).values(record).run()
  return record
}

/** Replaces mutable competition data while preserving identity and creation metadata. */
export function updateCompetitionRecord(
  input: UpdateCompetitionRecord,
  database: CompetitionDatabase = db,
): CompetitionEntry | null {
  const existing = getCompetitionById(input.id, database)
  if (!existing) return null

  database.update(competitionEntries).set({
    groupTrainingPlanId: input.draft.groupTrainingPlanId,
    name: input.draft.name,
    date: input.draft.date,
    distanceKm: input.draft.distanceKm,
    elevationGainM: input.draft.elevationGainM ?? null,
    priority: input.draft.priority,
    status: input.draft.status,
    description: input.draft.description ?? null,
    updatedAt: input.updatedAt,
  }).where(and(
    eq(competitionEntries.id, input.id),
    eq(competitionEntries.isDeleted, false),
  )).run()

  return getCompetitionById(input.id, database)
}

/** Updates only the competition date; lifecycle state is intentionally unchanged. */
export function rescheduleCompetitionRecord(
  id: string,
  date: string,
  updatedAt: string,
  database: CompetitionDatabase = db,
): CompetitionEntry | null {
  const existing = getCompetitionById(id, database)
  if (!existing) return null

  database.update(competitionEntries).set({ date, updatedAt }).where(and(
    eq(competitionEntries.id, id),
    eq(competitionEntries.isDeleted, false),
  )).run()

  return getCompetitionById(id, database)
}

/** Updates only lifecycle status after the application layer validates the transition. */
export function updateCompetitionStatusRecord(
  id: string,
  status: CompetitionStatus,
  updatedAt: string,
  database: CompetitionDatabase = db,
): CompetitionEntry | null {
  const existing = getCompetitionById(id, database)
  if (!existing) return null

  database.update(competitionEntries).set({ status, updatedAt }).where(and(
    eq(competitionEntries.id, id),
    eq(competitionEntries.isDeleted, false),
  )).run()

  return getCompetitionById(id, database)
}
