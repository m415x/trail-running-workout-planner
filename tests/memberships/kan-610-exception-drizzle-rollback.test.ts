import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { createDrizzleBillingDatabase } from '../../lib/memberships/billing-drizzle-database'

test('KAN-730 production atomic global exception rolls back revision when charge update fails', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec('CREATE TABLE revisions (id TEXT PRIMARY KEY, is_current INTEGER NOT NULL, created_by_user_id TEXT)')
    sqlite.exec('CREATE TABLE charges (id TEXT PRIMARY KEY, due_date TEXT NOT NULL)')
    sqlite.prepare('INSERT INTO revisions VALUES (?, ?, ?)').run('old', 1, null)
    sqlite.prepare('INSERT INTO charges VALUES (?, ?)').run('charge-a', '2026-10-10')
    let mutations = 0

    // Drizzle-like test double delegates transaction and SQL mutations to a real SQLite connection.
    const client = {
      select() {
        return {
          from() {
            return {
              where: async () => [{
                id: 'old', teamId: 'team-a', year: 2026, month: 10,
                dueDate: '2026-10-10', reason: 'Anterior',
                createdByUserId: null, isCurrent: true,
              }],
            }
          },
        }
      },
      transaction(callback: (tx: unknown) => void) {
        return sqlite.transaction(() => callback({
          update() {
            return {
              set(values: Record<string, unknown>) {
                return {
                  where() {
                    return {
                      run() {
                        mutations++
                        if (mutations === 1) {
                          sqlite.prepare('UPDATE revisions SET is_current = ? WHERE id = ?')
                            .run(values.isCurrent === false ? 0 : 1, 'old')
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

    const db = createDrizzleBillingDatabase(client as never)
    await assert.rejects(
      () => db.applyGlobalDueDateExceptionAtomically!(
        'team-a', 2026, 10, {
          id: 'new', teamId: 'team-a', year: 2026, month: 10,
          dueDate: '2026-10-15', reason: 'Excepción',
          createdByUserId: 'coach-1', isCurrent: true,
        }, [{
          athleteId: 'athlete-a', billingTermsId: 'terms-a', year: 2026, month: 10,
          baseAmountMinor: 1000, amountDueMinor: 1000, currency: 'ARS',
          baseDueDate: '2026-10-15', effectiveDueDate: '2026-10-15',
        }],
      ),
      /injected charge-write failure/,
    )
    assert.deepEqual(sqlite.prepare('SELECT * FROM revisions ORDER BY id').all(), [
      { id: 'old', is_current: 1, created_by_user_id: null },
    ])
    assert.deepEqual(sqlite.prepare('SELECT * FROM charges').all(), [
      { id: 'charge-a', due_date: '2026-10-10' },
    ])
  } finally {
    sqlite.close()
  }
})
