import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { runAuthorizedCompetitionMutation } from '@/lib/periodization/authorized-competition-calendar-mutation'

test('KAN-830 T4: denied multi-Team requests never invoke any competition writer or mutate SQLite', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec("CREATE TABLE competition_entries (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL)")
    const snapshot = () => sqlite.prepare('SELECT * FROM competition_entries ORDER BY id').all()
    const before = snapshot()
    const operations = ['create', 'update', 'reschedule', 'status', 'catalog'] as const
    const denied = ['anonymous', 'selection_required', 'foreign_team', 'missing_capability'] as const
    let writerCalls = 0
    for (const operation of operations) {
      for (const reason of denied) {
        const result = await runAuthorizedCompetitionMutation({
          authorize: async () => null as { teamId: string; planId: string } | null,
          onDenied: () => ({ ok: false as const, reason }),
          write: () => {
            writerCalls++
            sqlite.prepare('INSERT INTO competition_entries (id, group_training_plan_id, status, updated_at) VALUES (?, ?, ?, ?)').run(operation + reason, 'plan_a', 'planned', '2026-10-19')
            return { ok: true as const }
          },
        })
        assert.deepEqual(result, { ok: false, reason })
        assert.equal(writerCalls, 0)
        assert.deepEqual(snapshot(), before)
      }
    }
    const allowed = await runAuthorizedCompetitionMutation({
      authorize: async () => ({ teamId: 'team_a', planId: 'plan_a' }),
      onDenied: () => ({ ok: false as const }),
      write: ({ planId }) => {
        writerCalls++
        sqlite.prepare('INSERT INTO competition_entries (id, group_training_plan_id, status, updated_at) VALUES (?, ?, ?, ?)').run('allowed', planId, 'planned', '2026-10-19')
        return { ok: true as const }
      },
    })
    assert.deepEqual(allowed, { ok: true })
    assert.equal(writerCalls, 1)
    assert.equal(snapshot().length, 1)
  } finally {
    sqlite.close()
  }
})
