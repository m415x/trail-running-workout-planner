import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { createAuthorizedReviewSnapshotConfirmationOperations } from '@/lib/session-generation/authorized-review-snapshot-confirmation'
import { createReviewSnapshotReconciliationPersist } from '@/lib/session-generation/review-snapshot-confirm-reconciliation'

import { createTrustedSqliteReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-sqlite-operations'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE teams (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE planning_cohorts (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, planning_cohort_id TEXT, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_race_name TEXT, target_race_distance_km REAL, target_race_elevation_gain INTEGER);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, period TEXT NOT NULL);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, week_number INTEGER NOT NULL, type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_volume_km REAL, target_elevation_gain INTEGER, target_duration_min INTEGER);
    CREATE TABLE load_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, maximum_weekly_volume_km REAL NOT NULL, initial_weekly_volume_km REAL NOT NULL);
    CREATE TABLE intensity_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, default_method TEXT NOT NULL, maximum_intense_sessions_per_week INTEGER NOT NULL);
    CREATE TABLE microcycle_intensity_targets (id TEXT PRIMARY KEY, microcycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, intense_sessions_target INTEGER NOT NULL, predominant_zone TEXT NOT NULL, emphasis TEXT NOT NULL, reference_percentage_target REAL, minimum_recovery_days_between_intense_sessions INTEGER NOT NULL);
    CREATE TABLE session_generation_preferences (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, frequency_mode TEXT NOT NULL, fixed_sessions_per_week INTEGER, weekly_pattern TEXT NOT NULL);
    CREATE TABLE workouts (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, archived_at TEXT, category TEXT NOT NULL, tags TEXT NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, distance REAL, time INTEGER, gain INTEGER, intensity_method TEXT, zone TEXT, reference_percentage REAL, notes TEXT, prescription_notes TEXT, structure TEXT, track_path TEXT, location_key TEXT);
    CREATE TABLE competition_entries (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, date TEXT NOT NULL, distance_km REAL NOT NULL, elevation_gain_m REAL, priority TEXT NOT NULL, status TEXT NOT NULL, description TEXT);
    INSERT INTO users VALUES ('coach');
    INSERT INTO teams VALUES ('team-a');
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0),('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',NULL,0),('plan-b','group-b',NULL,0);
    INSERT INTO macrocycles VALUES ('macro-a','plan-a',0,'2027-01-01','2027-12-31',NULL,NULL,NULL);
    INSERT INTO mesocycles VALUES ('meso-a','macro-a',0,'general_preparatory');
    INSERT INTO microcycles VALUES ('week-a','meso-a',0,1,'base','2027-01-04','2027-01-10',40,700,300);
    INSERT INTO load_strategies VALUES ('load-a','plan-a',0,100,30);
    INSERT INTO intensity_strategies VALUES ('int-a','plan-a',0,'hr_zone',2);
    INSERT INTO microcycle_intensity_targets VALUES ('target-a','week-a',0,2,'Z2','aerobic',NULL,2);
    INSERT INTO session_generation_preferences VALUES ('prefs-a','plan-a',0,'auto',NULL,'[{"weekday":"monday","role":"base"},{"weekday":"wednesday","role":"quality"},{"weekday":"saturday","role":"long"}]');
    INSERT INTO workouts VALUES ('work-a','team-a',0,NULL,'endurance','[]','Easy','Trail',10,60,300,'hr_zone','Z2',NULL,NULL,NULL,NULL,NULL,NULL);
    INSERT INTO competition_entries VALUES ('race-a','plan-a',0,'Race','2027-05-01',21,800,'A','planned',NULL);
  `)
  db.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))

  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      team_id TEXT NOT NULL, workout_id TEXT, date TEXT NOT NULL,
      title TEXT NOT NULL, type TEXT NOT NULL, location_key TEXT,
      track_path TEXT, structure TEXT, notes TEXT,
      generation_ownership TEXT NOT NULL DEFAULT 'manual', shared_event_key TEXT UNIQUE
    );
    CREATE TABLE group_session_prescriptions (
      id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      session_id TEXT NOT NULL, group_id TEXT NOT NULL, microcycle_id TEXT NOT NULL,
      distance_km REAL, duration_min INTEGER, elevation_gain INTEGER,
      intensity_method TEXT, zone TEXT, reference_percentage REAL,
      notes TEXT, generation_ownership TEXT NOT NULL DEFAULT 'manual',
      generation_key TEXT UNIQUE, UNIQUE(session_id, microcycle_id)
    );
    CREATE TABLE session_generation_modification_records (
      id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      group_training_plan_id TEXT NOT NULL, session_id TEXT,
      prescription_id TEXT, action TEXT NOT NULL, ownership TEXT NOT NULL,
      generation_key TEXT, generation_explanation TEXT,
      previous_value TEXT, new_value TEXT, changed_by_user_id TEXT
    );
  `)
  return db
}

const ownedScope = {
  ...scope, userId: 'coach', planningCohortId: null,
}


const authorize = async () => ({ kind: 'authorized' as const, scope: ownedScope })
const request = { groupTrainingPlanId: scope.groupTrainingPlanId, snapshotId: 'snapshot-runtime' }
function counts(sqlite: Database.Database) {
  const count = (table: string): number =>
    (sqlite.prepare('SELECT COUNT(*) AS n FROM ' + table).get() as { n: number }).n
  return {
    sessions: count('sessions'),
    prescriptions: count('group_session_prescriptions'),
    audit: count('session_generation_modification_records'),
  }
}
async function setup() {
  const sqlite = fixture()
  const database = drizzle(sqlite, { schema })
  const create = createTrustedSqliteReviewSnapshotOperations({
    sqlite, authorize, now: () => '2026-10-14T15:00:00.000Z',
    createId: () => request.snapshotId,
  })
  assert.deepEqual(await create.create({ groupTrainingPlanId: scope.groupTrainingPlanId }),
    { kind: 'created', snapshotId: request.snapshotId })
  const persist = createReviewSnapshotReconciliationPersist({
    database, sqlite, authorizedGroupIds: new Set(['group-a']),
    now: () => '2026-10-14T15:01:00.000Z',
  })
  const confirm = createAuthorizedReviewSnapshotConfirmationOperations({
    sqlite, authorize, persist, now: () => '2026-10-14T15:01:00.000Z',
  })
  return { sqlite, confirm }
}
test('KAN-790 T5.4 runtime CONFIRM commits CAS Sessions prescriptions and explanation audit together', async () => {
  const { sqlite, confirm } = await setup()
  try {
    assert.deepEqual(await confirm.confirm(request),
      { kind: 'consumed', resultReference: scope.groupTrainingPlanId })
    const actual = counts(sqlite)
    assert.ok(actual.sessions > 0)
    assert.ok(actual.prescriptions > 0)
    assert.ok(actual.audit >= actual.prescriptions)
    const explanations = sqlite.prepare(
      'SELECT generation_explanation FROM session_generation_modification_records WHERE prescription_id IS NOT NULL'
    ).all() as Array<{ generation_explanation: string | null }>
    assert.ok(explanations.some(row => row.generation_explanation !== null))
    assert.deepEqual(await confirm.confirm(request),
      { kind: 'already_consumed', resultReference: scope.groupTrainingPlanId })
    assert.deepEqual(counts(sqlite), actual)
  } finally { sqlite.close() }
})
test('KAN-790 T5.4 audit failure rolls back CAS and all Session Prescription writes', async () => {
  const { sqlite, confirm } = await setup()
  try {
    sqlite.exec("CREATE TRIGGER reject_generation_audit BEFORE INSERT ON session_generation_modification_records BEGIN SELECT RAISE(ABORT, 'audit rejection probe'); END;")
    await assert.rejects(() => confirm.confirm(request), /audit rejection probe/)
    assert.deepEqual(counts(sqlite), { sessions: 0, prescriptions: 0, audit: 0 })
    const status = sqlite.prepare('SELECT status, consumed_at, result_reference FROM session_generation_review_snapshots WHERE id = ?')
      .get(request.snapshotId) as { status: string; consumed_at: string | null; result_reference: string | null }
    assert.deepEqual(status, { status: 'active', consumed_at: null, result_reference: null })
  } finally { sqlite.close() }
})

test('KAN-790 T5.4 shared event introduced in another Team denies CONFIRM without consuming CAS or changing records', async () => {
  const { sqlite, confirm } = await setup()
  try {
    const row = sqlite.prepare('SELECT proposal FROM session_generation_review_snapshots WHERE id = ?')
      .get(request.snapshotId) as { proposal: string }
    const proposal = JSON.parse(row.proposal) as { events: Array<{ sharedEventKey: string }> }
    assert.ok(proposal.events.length > 0)
    const sharedEventKey = proposal.events[0].sharedEventKey
    sqlite.prepare(`
      INSERT INTO sessions (id, team_id, date, title, type, shared_event_key, generation_ownership, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('occupied-session', 'team-a', '2027-01-05', 'Existing protected shared event',
      'Trail', sharedEventKey, 'generated', '2026-10-14T15:00:00.000Z', '2026-10-14T15:00:00.000Z')
    sqlite.prepare(`
      INSERT INTO group_session_prescriptions
        (id, session_id, group_id, microcycle_id, generation_ownership, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('foreign-prescription', 'occupied-session', 'group-b', 'week-a',
      'manual', '2026-10-14T15:00:00.000Z', '2026-10-14T15:00:00.000Z')

    const original = counts(sqlite)
    assert.deepEqual(original, { sessions: 1, prescriptions: 1, audit: 0 })
    await assert.rejects(
      () => confirm.confirm(request),
      /reconciliation_conflict: affected group authorization changed/,
    )
    assert.deepEqual(counts(sqlite), original)
    assert.equal((sqlite.prepare('SELECT is_deleted AS value FROM sessions WHERE id = ?')
      .get('occupied-session') as { value: number }).value, 0)
    assert.equal((sqlite.prepare('SELECT is_deleted AS value FROM group_session_prescriptions WHERE id = ?')
      .get('foreign-prescription') as { value: number }).value, 0)
    const status = sqlite.prepare(
      'SELECT status, consumed_at, result_reference FROM session_generation_review_snapshots WHERE id = ?',
    ).get(request.snapshotId) as { status: string; consumed_at: string | null; result_reference: string | null }
    assert.deepEqual(status, { status: 'active', consumed_at: null, result_reference: null })
  } finally { sqlite.close() }
})

test('KAN-790 T5.4 persisted Base explanation forged as Variant denies all writes and snapshot consumption', async () => {
  const { sqlite, confirm } = await setup()
  try {
    const row = sqlite.prepare(
      'SELECT generation_explanations FROM session_generation_review_snapshots WHERE id = ?',
    ).get(request.snapshotId) as { generation_explanations: string }
    const explanations = JSON.parse(row.generation_explanations) as Record<string, {
      planningScope: { kind: string; planningCohortId: string | null }
    }>
    const keys = Object.keys(explanations)
    assert.ok(keys.length > 0, 'generator must have created historical explanation evidence')
    const first = explanations[keys[0]]
    assert.equal(first.planningScope.kind, 'base')
    assert.equal(first.planningScope.planningCohortId, null)
    first.planningScope.kind = 'variant'
    first.planningScope.planningCohortId = 'other-cohort'
    sqlite.prepare(
      'UPDATE session_generation_review_snapshots SET generation_explanations = ? WHERE id = ?',
    ).run(JSON.stringify(explanations), request.snapshotId)

    await assert.rejects(
      () => confirm.confirm(request),
      /generation explanation planning scope does not match generation key/i,
    )
    assert.deepEqual(counts(sqlite), { sessions: 0, prescriptions: 0, audit: 0 })
    const state = sqlite.prepare(
      'SELECT status, consumed_at, result_reference FROM session_generation_review_snapshots WHERE id = ?',
    ).get(request.snapshotId) as { status: string; consumed_at: string | null; result_reference: string | null }
    assert.deepEqual(state, { status: 'active', consumed_at: null, result_reference: null })
  } finally { sqlite.close() }
})

test('KAN-790 T5.4 legitimate Variant confirms scoped explanations and preserves Base records', async () => {
  const sqlite = fixture()
  try {
    sqlite.exec(`
      INSERT INTO planning_cohorts (id) VALUES ('cohort-variant');
      INSERT INTO group_training_plans VALUES ('plan-variant','group-a','cohort-variant',0);
      INSERT INTO macrocycles VALUES ('macro-variant','plan-variant',0,'2027-01-01','2027-12-31',NULL,NULL,NULL);
      INSERT INTO mesocycles VALUES ('meso-variant','macro-variant',0,'general_preparatory');
      INSERT INTO microcycles VALUES ('week-variant','meso-variant',0,1,'base','2027-01-11','2027-01-17',40,700,300);
      INSERT INTO load_strategies VALUES ('load-variant','plan-variant',0,100,30);
      INSERT INTO intensity_strategies VALUES ('int-variant','plan-variant',0,'hr_zone',2);
      INSERT INTO microcycle_intensity_targets VALUES ('target-variant','week-variant',0,2,'Z2','aerobic',NULL,2);
      INSERT INTO session_generation_preferences VALUES ('prefs-variant','plan-variant',0,'auto',NULL,'[{"weekday":"monday","role":"base"},{"weekday":"wednesday","role":"quality"},{"weekday":"saturday","role":"long"}]');
      INSERT INTO sessions
        (id, team_id, date, title, type, generation_ownership, shared_event_key, created_at, updated_at)
      VALUES ('base-protected','team-a','2027-01-05','Base manual sentinel','Trail','manual',NULL,'2026-10-14T15:00:00.000Z','2026-10-14T15:00:00.000Z');
      INSERT INTO group_session_prescriptions
        (id, session_id, group_id, microcycle_id, generation_ownership, created_at, updated_at)
      VALUES ('base-prescription','base-protected','group-a','week-a','manual','2026-10-14T15:00:00.000Z','2026-10-14T15:00:00.000Z');
    `)
    const variantScope = {
      userId: 'coach', teamId: 'team-a', groupTrainingPlanId: 'plan-variant',
      groupId: 'group-a', planningCohortId: 'cohort-variant',
    }
    const authorizeVariant = async () => ({ kind: 'authorized' as const, scope: variantScope })
    const variantRequest = { groupTrainingPlanId: 'plan-variant', snapshotId: 'snapshot-variant' }
    const ops = createTrustedSqliteReviewSnapshotOperations({
      sqlite, authorize: authorizeVariant, now: () => '2026-10-14T15:00:00.000Z',
      createId: () => variantRequest.snapshotId,
    })
    assert.deepEqual(await ops.create({ groupTrainingPlanId: 'plan-variant' }),
      { kind: 'created', snapshotId: variantRequest.snapshotId })

    const stored = sqlite.prepare(
      'SELECT generation_explanations FROM session_generation_review_snapshots WHERE id = ?',
    ).get(variantRequest.snapshotId) as { generation_explanations: string }
    const explanations = JSON.parse(stored.generation_explanations) as Record<string, {
      planningScope: { kind: string; groupTrainingPlanId: string; planningCohortId: string | null; microcycleId: string }
    }>
    assert.ok(Object.keys(explanations).length > 0)
    assert.ok(Object.values(explanations).every(e =>
      e.planningScope.kind === 'variant' &&
      e.planningScope.groupTrainingPlanId === 'plan-variant' &&
      e.planningScope.planningCohortId === 'cohort-variant' &&
      e.planningScope.microcycleId === 'week-variant'))

    const persist = createReviewSnapshotReconciliationPersist({
      database: drizzle(sqlite, { schema }), sqlite,
      authorizedGroupIds: new Set(['group-a']),
      now: () => '2026-10-14T15:01:00.000Z',
    })
    const confirm = createAuthorizedReviewSnapshotConfirmationOperations({
      sqlite, authorize: authorizeVariant, persist,
      now: () => '2026-10-14T15:01:00.000Z',
    })
    assert.deepEqual(await confirm.confirm(variantRequest),
      { kind: 'consumed', resultReference: 'plan-variant' })
    const variantAudit = sqlite.prepare(
      "SELECT generation_explanation FROM session_generation_modification_records WHERE group_training_plan_id = 'plan-variant' AND prescription_id IS NOT NULL",
    ).all() as Array<{ generation_explanation: string | null }>
    assert.ok(variantAudit.length > 0)
    assert.ok(variantAudit.every(row => {
      const parsed = JSON.parse(row.generation_explanation ?? 'null') as {
        planningScope?: { kind: string; planningCohortId: string | null }
      } | null
      return parsed?.planningScope?.kind === 'variant' &&
        parsed.planningScope.planningCohortId === 'cohort-variant'
    }))
    const base = sqlite.prepare(
      'SELECT title, is_deleted FROM sessions WHERE id = ?',
    ).get('base-protected') as { title: string; is_deleted: number }
    assert.deepEqual(base, { title: 'Base manual sentinel', is_deleted: 0 })
    assert.equal((sqlite.prepare(
      'SELECT COUNT(*) AS n FROM group_session_prescriptions WHERE id = ? AND is_deleted = 0',
    ).get('base-prescription') as { n: number }).n, 1)
    assert.equal((sqlite.prepare(
      "SELECT COUNT(*) AS n FROM session_generation_modification_records WHERE group_training_plan_id = 'plan-a'",
    ).get() as { n: number }).n, 0)
  } finally { sqlite.close() }
})
