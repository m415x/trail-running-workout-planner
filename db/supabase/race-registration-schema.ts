import { sql } from 'drizzle-orm'
import { check, doublePrecision, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

import { raceCourses, raceEditions, raceEvents } from '@/db/supabase/race-catalog-schema'
import { baseColumns } from '@/db/supabase/schema'
import type {
  RaceParticipationStatus,
  RaceRegistrationStatus,
} from '@/types/training/race-registration.types'

export const raceRegistrations = pgTable(
  'race_registrations',
  {
    ...baseColumns,
    teamId: text('team_id').notNull(),
    athleteProfileId: text('athlete_profile_id').notNull(),
    raceEventId: text('race_event_id')
      .notNull()
      .references(() => raceEvents.id, { onDelete: 'restrict' }),
    raceEditionId: text('race_edition_id')
      .notNull()
      .references(() => raceEditions.id, { onDelete: 'restrict' }),
    raceCourseId: text('race_course_id')
      .notNull()
      .references(() => raceCourses.id, { onDelete: 'restrict' }),
    registrationStatus: text('registration_status').$type<RaceRegistrationStatus>().notNull(),
    participationStatus: text('participation_status').$type<RaceParticipationStatus>().notNull(),

    snapshotEventName: text('snapshot_event_name').notNull(),
    snapshotEditionLabel: text('snapshot_edition_label').notNull(),
    snapshotEditionDate: text('snapshot_edition_date').notNull(),
    snapshotCourseLabel: text('snapshot_course_label').notNull(),
    snapshotNominalDistanceKm: doublePrecision('snapshot_nominal_distance_km'),
    snapshotNominalElevationGainM: doublePrecision('snapshot_nominal_elevation_gain_m'),

    resultActualDistanceKm: doublePrecision('result_actual_distance_km'),
    resultElapsedTimeSeconds: integer('result_elapsed_time_seconds'),
  },
  (table) => [
    uniqueIndex('race_registrations_team_athlete_edition_unique').on(
      table.teamId,
      table.athleteProfileId,
      table.raceEditionId,
    ),
    index('race_registrations_team_athlete_idx').on(table.teamId, table.athleteProfileId),
    index('race_registrations_course_idx').on(table.raceCourseId),
    check(
      'race_registrations_registration_status_check',
      sql`${table.registrationStatus} in ('registered', 'cancelled')`,
    ),
    check(
      'race_registrations_participation_status_check',
      sql`${table.participationStatus} in ('unknown', 'started', 'finished', 'dnf', 'dns')`,
    ),
    check(
      'race_registrations_snapshot_nominal_distance_check',
      sql`${table.snapshotNominalDistanceKm} is null or ${table.snapshotNominalDistanceKm} >= 0`,
    ),
    check(
      'race_registrations_snapshot_nominal_elevation_check',
      sql`${table.snapshotNominalElevationGainM} is null or ${table.snapshotNominalElevationGainM} >= 0`,
    ),
    check(
      'race_registrations_result_actual_distance_check',
      sql`${table.resultActualDistanceKm} is null or ${table.resultActualDistanceKm} >= 0`,
    ),
    check(
      'race_registrations_result_elapsed_time_check',
      sql`${table.resultElapsedTimeSeconds} is null or ${table.resultElapsedTimeSeconds} >= 0`,
    ),
  ],
)
