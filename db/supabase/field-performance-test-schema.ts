import { sql } from 'drizzle-orm'
import { check, doublePrecision, index, integer, pgTable, text } from 'drizzle-orm/pg-core'

import { athleteProfiles, baseColumns } from '@/db/supabase/schema'
import type { FieldPerformanceTestProtocol } from '@/lib/physiology/field-performance-test'

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
    distanceM: integer('distance_m').notNull(),
    elapsedTimeSec: doublePrecision('elapsed_time_sec').notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('field_performance_tests_athlete_date_idx').on(table.athleteId, table.performedAt),
    check('field_performance_tests_protocol_check', sql`${table.protocol} = '1000m_track'`),
    check('field_performance_tests_distance_check', sql`${table.distanceM} = 1000`),
    check('field_performance_tests_elapsed_time_check', sql`${table.elapsedTimeSec} > 0`),
  ],
)
