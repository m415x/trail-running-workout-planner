import { and, asc, eq, lte } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { fieldPerformanceTests } from '@/db/schema'
import type { FieldPerformanceTestReviewStatus } from '@/lib/physiology/field-performance-test'
import type { FieldPerformanceTestRow } from '@/lib/physiology/field-performance-test-history'

type FieldPerformanceTestDb = BetterSQLite3Database<Record<string, unknown>>

export type InsertFieldPerformanceTest = Omit<FieldPerformanceTestRow, 'isDeleted'>

export interface SqliteFieldPerformanceTestRepository {
  insert(evaluation: InsertFieldPerformanceTest): FieldPerformanceTestRow
  listActiveByAthlete(athleteId: string): FieldPerformanceTestRow[]
  listActiveByAthleteThroughDate(athleteId: string, effectiveDate: string): FieldPerformanceTestRow[]
  getById(id: string): FieldPerformanceTestRow | undefined
  invalidate(id: string, updatedAt: string): void
  review(id: string, reviewStatus: Exclude<FieldPerformanceTestReviewStatus, 'pending_review'>, updatedAt: string): FieldPerformanceTestRow
  replace(id: string, replacement: InsertFieldPerformanceTest, updatedAt: string): FieldPerformanceTestRow
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

    listActiveByAthleteThroughDate(athleteId, effectiveDate) {
      return db
        .select()
        .from(fieldPerformanceTests)
        .where(
          and(
            eq(fieldPerformanceTests.athleteId, athleteId),
            eq(fieldPerformanceTests.isDeleted, false),
            lte(fieldPerformanceTests.performedAt, effectiveDate),
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

    review(id, reviewStatus, updatedAt) {
      const reviewed = db
        .update(fieldPerformanceTests)
        .set({ reviewStatus, updatedAt })
        .where(
          and(
            eq(fieldPerformanceTests.id, id),
            eq(fieldPerformanceTests.reviewStatus, 'pending_review'),
            eq(fieldPerformanceTests.isDeleted, false),
          ),
        )
        .returning()
        .get()

      if (!reviewed) {
        throw new Error('only active pending_review evidence can be reviewed')
      }

      return reviewed as FieldPerformanceTestRow
    },

    replace(id, replacement, updatedAt) {
      return db.transaction((tx) => {
        tx.update(fieldPerformanceTests)
          .set({ isDeleted: true, updatedAt })
          .where(eq(fieldPerformanceTests.id, id))
          .run()

        const inserted = tx
          .insert(fieldPerformanceTests)
          .values({ ...replacement, isDeleted: false })
          .returning()
          .get()

        return inserted as FieldPerformanceTestRow
      })
    },
  }
}
