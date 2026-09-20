import { sql } from 'drizzle-orm'
import { check, doublePrecision, index, integer, pgTable, text } from 'drizzle-orm/pg-core'

import { athleteGroups, athleteProfiles, baseColumns, teams, users } from '@/db/supabase/schema'
import type { FieldPerformanceTestProtocol, FieldPerformanceTestSource } from '@/lib/physiology/field-performance-test'

export const fieldPerformanceTestEvents = pgTable(
  'field_performance_test_events',
  {
    ...baseColumns,
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    groupId: text('group_id').notNull().references(() => athleteGroups.id, { onDelete: 'restrict' }),
    scheduledAt: text('scheduled_at').notNull(),
    protocol: text('protocol').$type<FieldPerformanceTestProtocol>().notNull(),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('field_performance_test_events_team_group_date_idx').on(table.teamId, table.groupId, table.scheduledAt),
    check('field_performance_test_events_protocol_check', sql`${table.protocol} = '1000m_track'`),
  ],
)

/** PostgreSQL parity for append-only observed field-performance evidence. */
export const fieldPerformanceTests = pgTable(
  'field_performance_tests',
  {
    ...baseColumns,
    athleteId: text('athlete_id')
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: 'cascade' }),
    performedAt: text('performed_at').notNull(),
    protocol: text('protocol').$type<FieldPerformanceTestProtocol>().notNull(),
    source: text('source').$type<FieldPerformanceTestSource>().notNull(),
    testEventId: text('test_event_id').references(() => fieldPerformanceTestEvents.id, { onDelete: 'restrict' }),
    executionContext: text('execution_context').$type<'official' | 'self_directed'>(),
    recordedBy: text('recorded_by').$type<'coach' | 'athlete'>(),
    recordedByUserId: text('recorded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reviewStatus: text('review_status').$type<'accepted' | 'pending_review' | 'rejected'>(),
    distanceM: integer('distance_m').notNull(),
    elapsedTimeSec: doublePrecision('elapsed_time_sec').notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('field_performance_tests_athlete_date_idx').on(table.athleteId, table.performedAt),
    check('field_performance_tests_protocol_check', sql`${table.protocol} = '1000m_track'`),
    check('field_performance_tests_source_check', sql`${table.source} in ('coach_manual', 'athlete_manual', 'legacy_migration')`),
    check('field_performance_tests_execution_context_check', sql`${table.executionContext} is null or ${table.executionContext} in ('official', 'self_directed')`),
    check('field_performance_tests_recorded_by_check', sql`${table.recordedBy} is null or ${table.recordedBy} in ('coach', 'athlete')`),
    check('field_performance_tests_review_status_check', sql`${table.reviewStatus} is null or ${table.reviewStatus} in ('accepted', 'pending_review', 'rejected')`),
    check('field_performance_tests_official_event_check', sql`${table.executionContext} is null or ${table.executionContext} <> 'official' or ${table.testEventId} is not null`),
    check('field_performance_tests_self_directed_event_check', sql`${table.executionContext} is null or ${table.executionContext} <> 'self_directed' or ${table.testEventId} is null`),
    check('field_performance_tests_distance_check', sql`${table.distanceM} = 1000`),
    check('field_performance_tests_elapsed_time_check', sql`${table.elapsedTimeSec} > 0`),
  ],
)
