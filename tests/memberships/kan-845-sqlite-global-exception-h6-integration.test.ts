import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'
import { createH6EconomicAuthorizationBoundary } from '@/lib/authorization/h6-economic-authorization'
import { createH6EconomicExceptionActions } from '@/lib/memberships/h6-economic-exception-actions'
import { createDrizzleBillingDatabase } from '@/lib/memberships/billing-drizzle-database'
import type { EffectiveTeamMembership } from '@/lib/authorization/effective-authorization'

test('KAN-845 economic global exception uses real Drizzle writer and preserves both Teams on DENY', async () => {
  const sql = new Database(':memory:')
  sql.pragma('foreign_keys = ON')
  try {
    sql.exec(`
      CREATE TABLE users (id text PRIMARY KEY);
      CREATE TABLE teams (id text PRIMARY KEY);
      CREATE TABLE team_memberships (user_id text, team_id text, preset text, is_active integer, is_deleted integer, effective_from text, effective_until text);
      CREATE TABLE global_monthly_due_date_exceptions (
        id text PRIMARY KEY, team_id text NOT NULL REFERENCES teams(id),
        year integer NOT NULL, month integer NOT NULL, due_date text NOT NULL,
        reason text NOT NULL, created_by_user_id text REFERENCES users(id),
        is_current integer NOT NULL, is_deleted integer NOT NULL,
        created_at text NOT NULL, updated_at text NOT NULL
      );
      INSERT INTO users VALUES ('coach-a');
      INSERT INTO teams VALUES ('team-a'),('team-b');
      INSERT INTO team_memberships VALUES
        ('coach-a','team-a','coach',1,0,'2025-01-01',NULL),
        ('coach-a','team-b','coach',1,0,'2025-01-01',NULL);
      INSERT INTO global_monthly_due_date_exceptions VALUES
        ('ex-a','team-a',2026,10,'2026-10-10','A','coach-a',1,0,'2026-10-01','2026-10-01'),
        ('ex-b','team-b',2026,10,'2026-10-11','B','coach-a',1,0,'2026-10-01','2026-10-01');
    `)
    const database = createDrizzleBillingDatabase(drizzle(sql))
    let selected: string | null = 'team-b'
    let authenticated = true
    const memberships = () => sql.prepare("SELECT * FROM team_memberships WHERE user_id = 'coach-a'").all() as Array<{
      user_id: string; team_id: string; preset: 'coach' | 'athlete'; is_active: number; is_deleted: number; effective_from: string; effective_until: string | null
    }>
    const boundary = createH6EconomicAuthorizationBoundary({
      resolveActiveTeam: async () => resolveActiveTeamContext({
        persistedTeamId: selected, onDate: '2026-10-21',
        memberships: memberships().map(m => ({ teamId: m.team_id, isActive: Boolean(m.is_active), isDeleted: Boolean(m.is_deleted), effectiveFrom: m.effective_from, effectiveUntil: m.effective_until })),
      }),
      loadMemberships: async (userId, teamId): Promise<EffectiveTeamMembership[]> => memberships()
        .filter(m => m.user_id === userId && m.team_id === teamId)
        .map(m => ({ userId: m.user_id, teamId: m.team_id, preset: m.preset, isActive: Boolean(m.is_active) && !Boolean(m.is_deleted), effectiveFrom: m.effective_from, effectiveUntil: m.effective_until })),
      resolveResourceTeam: async (id, teamId) => id === '__active_team_economy__' && sql.prepare('SELECT id FROM teams WHERE id = ?').get(teamId) ? teamId : null,
    })
    let writes = 0
    const actions = createH6EconomicExceptionActions({
      authenticate: async () => authenticated ? { status: 'authenticated' as const, userId: 'coach-a' } : { status: 'forbidden' as const, reason: 'anonymous' as const },
      authorize: (actor, request) => boundary.authorize(actor, request),
      ownsCharge: async () => false,
      globalDueDate: async (teamId, input, author) => {
        writes++
        await database.replaceCurrentGlobalDueDateException(teamId, input.year, input.month, {
          id: 'ex-b-2', teamId, year: input.year, month: input.month,
          dueDate: input.dueDate, reason: input.reason,
          createdByUserId: author.effectiveActorUserId, isCurrent: true,
        })
        return { success: true as const }
      },
      reduce: async () => { throw new Error('unexpected reduction') },
      extend: async () => { throw new Error('unexpected extension') },
      revalidate: () => {},
      now: () => '2026-10-21T12:00:00.000Z',
    })
    const snapshot = () => sql.prepare('SELECT id, team_id, due_date, is_current, created_by_user_id FROM global_monthly_due_date_exceptions ORDER BY id').all()
    const input = { year: 2026, month: 10, dueDate: '2026-10-25', reason: 'Updated', locale: 'es' as const }
    assert.equal((await actions.global(input)).success, true)
    assert.equal(writes, 1)
    assert.deepEqual(sql.prepare("SELECT id, due_date, is_current FROM global_monthly_due_date_exceptions WHERE team_id = 'team-a'").all(),
      [{ id: 'ex-a', due_date: '2026-10-10', is_current: 1 }])
    assert.deepEqual(sql.prepare("SELECT id, is_current, created_by_user_id FROM global_monthly_due_date_exceptions WHERE team_id = 'team-b' ORDER BY id").all(),
      [{ id: 'ex-b', is_current: 0, created_by_user_id: 'coach-a' }, { id: 'ex-b-2', is_current: 1, created_by_user_id: 'coach-a' }])
    const baseline = snapshot()
    const deny = async (label: string) => {
      const result = await actions.global(input)
      assert.equal(result.success, false, label)
      assert.equal(writes, 1, label + ': no writer callback')
      assert.deepEqual(snapshot(), baseline, label + ': no durable mutation')
    }
    selected = null
    await deny('selection_required')
    selected = 'team-a'
    sql.prepare("UPDATE team_memberships SET is_active = 0 WHERE team_id = 'team-a'").run()
    await deny('revoked Team A')
    selected = 'team-b'
    sql.prepare("UPDATE team_memberships SET preset = 'athlete' WHERE team_id = 'team-b'").run()
    await deny('insufficient economic capability')
    sql.prepare("UPDATE team_memberships SET preset = 'coach' WHERE team_id = 'team-b'").run()
    authenticated = false
    await deny('anonymous H2')
    assert.deepEqual(sql.pragma('foreign_key_check'), [])
  } finally {
    sql.close()
  }
})
