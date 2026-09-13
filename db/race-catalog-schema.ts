import { sql } from 'drizzle-orm'
import { check, index, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { competitionEntries } from '@/db/competition-entry-schema'
import { baseColumns, trainingGoals } from '@/db/schema'
import type {
  RaceCatalogSourceOrigin,
  RaceCourseClassification,
  RaceCourseModality,
  RaceCourseStatus,
  RaceEditionLocation,
  RaceEditionStatus,
  RaceEventStatus,
} from '@/types/training/race-catalog.types'

const sourceColumns = {
  sourceOrigin: text('source_origin').$type<RaceCatalogSourceOrigin>().notNull().default('product'),
  sourceProvider: text('source_provider'),
  externalId: text('external_id'),
  sourceUrl: text('source_url'),
}

export const raceEvents = sqliteTable(
  'race_events',
  {
    ...baseColumns,
    name: text('name').notNull(),
    websiteUrl: text('website_url'),
    description: text('description'),
    status: text('status').$type<RaceEventStatus>().notNull().default('active'),
    ...sourceColumns,
  },
  (table) => [
    index('race_events_status_name_idx').on(table.status, table.name),
    uniqueIndex('race_events_source_external_unique').on(table.sourceProvider, table.externalId),
    check('race_events_name_check', sql`length(trim(${table.name})) > 0`),
    check('race_events_status_check', sql`${table.status} in ('active', 'archived')`),
    check('race_events_source_origin_check', sql`${table.sourceOrigin} in ('product', 'external')`),
    check(
      'race_events_external_source_check',
      sql`${table.sourceOrigin} = 'product' or (${table.sourceProvider} is not null and ${table.externalId} is not null)`,
    ),
  ],
)

export const raceEditions = sqliteTable(
  'race_editions',
  {
    ...baseColumns,
    raceEventId: text('race_event_id')
      .notNull()
      .references(() => raceEvents.id, { onDelete: 'restrict' }),
    label: text('label').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    organizerName: text('organizer_name'),
    location: text('location', { mode: 'json' }).$type<RaceEditionLocation | null>(),
    websiteUrl: text('website_url'),
    notes: text('notes'),
    status: text('status').$type<RaceEditionStatus>().notNull().default('draft'),
    ...sourceColumns,
  },
  (table) => [
    index('race_editions_event_start_idx').on(table.raceEventId, table.startDate),
    index('race_editions_status_start_idx').on(table.status, table.startDate),
    uniqueIndex('race_editions_source_external_unique').on(table.sourceProvider, table.externalId),
    check('race_editions_label_check', sql`length(trim(${table.label})) > 0`),
    check('race_editions_date_order_check', sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`),
    check(
      'race_editions_status_check',
      sql`${table.status} in ('draft', 'published', 'completed', 'cancelled')`,
    ),
    check('race_editions_source_origin_check', sql`${table.sourceOrigin} in ('product', 'external')`),
    check(
      'race_editions_external_source_check',
      sql`${table.sourceOrigin} = 'product' or (${table.sourceProvider} is not null and ${table.externalId} is not null)`,
    ),
  ],
)

export const raceCourses = sqliteTable(
  'race_courses',
  {
    ...baseColumns,
    raceEditionId: text('race_edition_id')
      .notNull()
      .references(() => raceEditions.id, { onDelete: 'restrict' }),
    label: text('label').notNull(),
    distanceKm: real('distance_km'),
    elevationGainM: real('elevation_gain_m'),
    modality: text('modality', { mode: 'json' }).$type<RaceCourseModality | null>(),
    classifications: text('classifications', { mode: 'json' })
      .$type<RaceCourseClassification[]>()
      .notNull(),
    scheduledStartAt: text('scheduled_start_at'),
    startLocationLabel: text('start_location_label'),
    notes: text('notes'),
    status: text('status').$type<RaceCourseStatus>().notNull().default('draft'),
    ...sourceColumns,
  },
  (table) => [
    index('race_courses_edition_status_idx').on(table.raceEditionId, table.status),
    index('race_courses_distance_idx').on(table.distanceKm),
    uniqueIndex('race_courses_source_external_unique').on(table.sourceProvider, table.externalId),
    check('race_courses_label_check', sql`length(trim(${table.label})) > 0`),
    check('race_courses_distance_check', sql`${table.distanceKm} is null or ${table.distanceKm} > 0`),
    check('race_courses_elevation_check', sql`${table.elevationGainM} is null or ${table.elevationGainM} >= 0`),
    check('race_courses_status_check', sql`${table.status} in ('draft', 'published', 'cancelled')`),
    check('race_courses_source_origin_check', sql`${table.sourceOrigin} in ('product', 'external')`),
    check(
      'race_courses_external_source_check',
      sql`${table.sourceOrigin} = 'product' or (${table.sourceProvider} is not null and ${table.externalId} is not null)`,
    ),
  ],
)

/** Optional normalized catalog link. CompetitionEntry remains an immutable planning snapshot. */
export const competitionEntryRaceCourses = sqliteTable(
  'competition_entry_race_courses',
  {
    competitionEntryId: text('competition_entry_id')
      .primaryKey()
      .references(() => competitionEntries.id, { onDelete: 'cascade' }),
    raceCourseId: text('race_course_id')
      .notNull()
      .references(() => raceCourses.id, { onDelete: 'restrict' }),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index('competition_entry_race_courses_course_idx').on(table.raceCourseId)],
)

/** Optional normalized catalog link. Manual/legacy TrainingGoal rows remain valid without it. */
export const trainingGoalRaceCourses = sqliteTable(
  'training_goal_race_courses',
  {
    trainingGoalId: text('training_goal_id')
      .primaryKey()
      .references(() => trainingGoals.id, { onDelete: 'cascade' }),
    raceCourseId: text('race_course_id')
      .notNull()
      .references(() => raceCourses.id, { onDelete: 'restrict' }),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index('training_goal_race_courses_course_idx').on(table.raceCourseId)],
)
