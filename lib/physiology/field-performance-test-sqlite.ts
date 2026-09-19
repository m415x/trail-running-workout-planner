import { and, asc, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { fieldPerformanceTests } from '@/db/schema'
import type { FieldPerformanceTestRow } from '@/lib/physiology/field-performance-test-history'

type FieldPerformanceTestDb = BetterSQLite3Database<Record<string, unknown>>

export type InsertFieldPerformanceTest = Omit<FieldPerformanceTestRow, 'isDeleted'>

export interface SqliteFieldPerformanceTestRepository {
  insert(evaluation: InsertFieldPerformanceTest): FieldPerformanceTestRow
  listActiveByAthlete(athleteId: string): FieldPerformanceTestRow[]
  getById(id: string): FieldPerformanceTestRow | undefined
  invalidate(id: string, updatedAt: string): void
}

/** SQLite persistence boundary for append-only 1000 m performance evidence. */
export function createSqliteFieldPerformanceTestRepository(
  db: FieldPerformanceTestDb,
): SqliteFieldPerformanceTestRepository {
  return {
    insert(evaluation) {
      const inserted = db
        .insert(fieldPerformanceTests)
        .values({ ...evaluation, isDeleted: false })
        .returning()
        .get()

      return inserted as FieldPerformanceTestRow
    },

    listActiveByAthlete(athleteId) {
      return db
        .select()
        .from(fieldPerformanceTests)
        .where(
          and(
            eq(fieldPerformanceTests.athleteId, athleteId),
            eq(fieldPerformanceTests.isDeleted, false),
          ),
        )
        .orderBy(
          asc(fieldPerformanceTests.performedAt),
          asc(fieldPerformanceTests.createdAt),
          asc(fieldPerformanceTests.id),
        )
        .all() as FieldPerformanceTestRow[]
    },

    getById(id) {
      return db
        .select()
        .from(fieldPerformanceTests)
        .where(eq(fieldPerformanceTests.id, id))
        .get() as FieldPerformanceTestRow | undefined
    },

    invalidate(id, updatedAt) {
      db.update(fieldPerformanceTests)
        .set({ isDeleted: true, updatedAt })
        .where(eq(fieldPerformanceTests.id, id))
        .run()
    },
  }
}
