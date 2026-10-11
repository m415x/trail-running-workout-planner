import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { createDrizzleBillingDatabase } from '../../lib/memberships/billing-drizzle-database'

for (const kind of ['reduction', 'extension'] as const) {
  test('KAN-730 ' + kind + ' atomic Drizzle writer rolls back revision on charge-write failure', async () => {
    const sqlite = new Database(':memory:')
    try {
      sqlite.exec('CREATE TABLE revisions (id TEXT PRIMARY KEY, is_current INTEGER NOT NULL, created_by_user_id TEXT)')
      sqlite.exec('CREATE TABLE charges (id TEXT PRIMARY KEY, amount INTEGER NOT NULL, due_date TEXT NOT NULL)')
      sqlite.prepare('INSERT INTO revisions VALUES (?, ?, ?)').run('old', 1, null)
      sqlite.prepare('INSERT INTO charges VALUES (?, ?, ?)').run('charge-a', 1000, '2026-10-10')
      let writes = 0
      const client = {
        select() {
          return {
            from() {
              return {
                where: async () => [{
                  id: 'old', teamId: 'team-a', athleteId: 'athlete-a', monthlyChargeId: 'charge-a',
                  year: 2026, month: 10, reductionAmountMinor: 100,
                  extendedDueDate: '2026-10-10', reason: 'Anterior',
                  createdByUserId: null, isCurrent: true, isDeleted: false,
                }],
              }
            },
          }
        },
        transaction(callback: (tx: unknown) => void) {
          return sqlite.transaction(() => callback({
            update() {
              return {
                set(_values: Record<string, unknown>) {
                  void _values
                  return {
                    where() {
                      return {
                        run() {
                          writes++
                          if (writes === 1) {
                            sqlite.prepare('UPDATE revisions SET is_current = 0 WHERE id = ?').run('old')
                          } else {
                            throw new Error('injected charge-write failure')
                          }
                        },
                      }
                    },
                  }
                },
              }
            },
            insert() {
              return {
                values(rows: Array<Record<string, unknown>>) {
                  return {
                    run() {
                      sqlite.prepare('INSERT INTO revisions VALUES (?, ?, ?)')
                        .run(rows[0].id, rows[0].isCurrent ? 1 : 0, rows[0].createdByUserId)
                    },
                  }
                },
              }
            },
          }))()
        },
      }
      const repository = createDrizzleBillingDatabase(client as never)
      const charge = {
        athleteId: 'athlete-a', billingTermsId: 'terms-a', year: 2026, month: 10,
        baseAmountMinor: 1000, amountDueMinor: 900, currency: 'ARS',
        baseDueDate: '2026-10-10', effectiveDueDate: '2026-10-15',
      }
      const shared = {
        id: 'new', monthlyChargeId: 'charge-a', athleteId: 'athlete-a',
        year: 2026, month: 10, reason: 'Nuevo ajuste',
        createdByUserId: 'coach-1', isCurrent: true,
      }
      if (kind === 'reduction') {
        await assert.rejects(() => repository.applyMonthlyChargeReductionAtomically!(
          'team-a', 'charge-a', { ...shared, reductionAmountMinor: 200 }, charge,
        ), /injected charge-write failure/)
      } else {
        await assert.rejects(() => repository.applyMonthlyChargeExtensionAtomically!(
          'team-a', 'charge-a', { ...shared, extendedDueDate: '2026-10-15' }, charge,
        ), /injected charge-write failure/)
      }
      assert.deepEqual(sqlite.prepare('SELECT * FROM revisions ORDER BY id').all(), [
        { id: 'old', is_current: 1, created_by_user_id: null },
      ])
      assert.deepEqual(sqlite.prepare('SELECT * FROM charges').all(), [
        { id: 'charge-a', amount: 1000, due_date: '2026-10-10' },
      ])
    } finally {
      sqlite.close()
    }
  })
}
