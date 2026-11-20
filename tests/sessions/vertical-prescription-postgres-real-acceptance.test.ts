import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import postgres from 'postgres'

import { assertSafeKan878PostgresTarget } from '../../scripts/kan-878-postgres-acceptance-target'
import { persistVerticalPrescriptionPostgres } from '../../lib/sessions/vertical-prescription-postgres-writer'
import { readVerticalPrescriptionPostgres } from '../../lib/sessions/vertical-prescription-postgres-reader'

// The focused TDD runner guards this exact file before execution. Direct test
// invocations must also fail closed against any unsafe connection target.
// No connection or test writes occur without an explicit KAN878_PG_URL.
const acceptanceUrl = process.env.KAN878_PG_URL

test('KAN-878 real PostgreSQL 0043 TEMP migration, round-trip, audit, idempotency, DENY and rollback', {
  skip: !acceptanceUrl
    ? 'SKIP: KAN878_PG_URL not configured; this is NOT a PostgreSQL acceptance PASS'
    : false,
}, async () => {
  assertSafeKan878PostgresTarget(process.env)
  const sql = postgres(acceptanceUrl!, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
  })

  // Every fixture relation is TEMP and therefore session-private; no live
  // application table or migration journal is modified by this acceptance.
  const migrationSql = readFileSync(
    resolve('drizzle/supabase/0043_group_session_vertical_prescription.sql'),
    'utf8',
  )
  const migrationStatements = migrationSql.split('--> statement-breakpoint')
    .map(statement => statement.trim()).filter(Boolean)
  assert.equal(migrationStatements.length, 2)

  const block = {
    schemaVersion: 1 as const,
    direction: 'ascent' as const,
    repetitions: 2,
    coverage: 'complete' as const,
    elevationGainPerRep: {
      meters: 400,
      provenance: { kind: 'coach_manual' as const },
    },
    elevationLossPerRep: {
      meters: null,
      provenance: { kind: 'unknown' as const },
    },
  }
  const scope = { sessionId: 'session-a', microcycleId: 'microcycle-a' }
  const command = {
    ...scope,
    planId: 'plan-a',
    userId: 'coach-a',
    now: '2026-11-20T00:00:00Z',
    authorized: true,
    primaryObjective: 'elevation_gain' as const,
    elevationGain: 800,
    verticalBlock: block,
  }

  // The postgres tagged tx object is also a callable template function.
  // Both repository interfaces intentionally use the same caller-owned tx.
  type RepositoryTransaction =
    Parameters<typeof persistVerticalPrescriptionPostgres>[0]
    & Parameters<typeof readVerticalPrescriptionPostgres>[0]

  try {
    await sql.begin(async tx => {
      await tx`
        CREATE TEMP TABLE group_session_prescriptions (
          id text PRIMARY KEY,
          session_id text NOT NULL,
          microcycle_id text NOT NULL,
          generation_ownership text NOT NULL DEFAULT 'manual',
          is_deleted boolean NOT NULL DEFAULT false,
          elevation_gain integer,
          updated_at text NOT NULL,
          UNIQUE (session_id, microcycle_id)
        ) ON COMMIT PRESERVE ROWS
      `
      await tx`
        CREATE TEMP TABLE session_generation_modification_records (
          id text PRIMARY KEY,
          group_training_plan_id text NOT NULL,
          session_id text NOT NULL,
          prescription_id text NOT NULL,
          action text NOT NULL,
          ownership text NOT NULL,
          generation_key text,
          previous_value text,
          new_value text,
          changed_by_user_id text NOT NULL,
          created_at text NOT NULL,
          updated_at text NOT NULL
        ) ON COMMIT PRESERVE ROWS
      `
      await tx`
        INSERT INTO group_session_prescriptions
          (id, session_id, microcycle_id, elevation_gain, updated_at)
        VALUES ('prescription-a', 'session-a', 'microcycle-a', 650,
          '2026-11-19T00:00:00Z')
      `

      const before = await tx`
        SELECT elevation_gain FROM group_session_prescriptions
        WHERE id = 'prescription-a'
      `
      assert.equal(before[0]?.elevation_gain, 650)
      for (const statement of migrationStatements) {
        await tx.unsafe(statement)
      }

      const legacy = await readVerticalPrescriptionPostgres(
        tx as unknown as RepositoryTransaction, scope,
      )
      assert.deepEqual(legacy, {
        status: 'found',
        prescriptionId: 'prescription-a',
        primaryObjective: null,
        elevationGain: 650,
        verticalBlock: { status: 'absent' },
      })
    })

    await sql.begin(async tx => {
      const query = tx as unknown as RepositoryTransaction
      assert.equal(await persistVerticalPrescriptionPostgres(query, command), 'updated')
      assert.equal(await persistVerticalPrescriptionPostgres(query, command), 'unchanged')
      assert.deepEqual(await readVerticalPrescriptionPostgres(query, scope), {
        status: 'found',
        prescriptionId: 'prescription-a',
        primaryObjective: 'elevation_gain',
        elevationGain: 800,
        verticalBlock: { status: 'valid', block },
      })
      assert.deepEqual(
        await readVerticalPrescriptionPostgres(query, {
          sessionId: 'session-a', microcycleId: 'microcycle-b',
        }),
        { status: 'not_found' },
      )
      await assert.rejects(
        () => persistVerticalPrescriptionPostgres(query, { ...command, authorized: false }),
        /authoriz|denied|forbidden/i,
      )
      const audit = await tx`
        SELECT action, ownership, previous_value, new_value, changed_by_user_id
        FROM session_generation_modification_records
      `
      assert.equal(audit.length, 1)
      assert.equal(audit[0].action, 'manual_modified')
      assert.equal(audit[0].ownership, 'manual')
      assert.equal(audit[0].changed_by_user_id, 'coach-a')
      assert.deepEqual(JSON.parse(audit[0].previous_value as string), {
        elevationGain: 650,
        primaryObjective: null,
        verticalBlockJson: null,
      })
      assert.deepEqual(JSON.parse(audit[0].new_value as string), {
        elevationGain: 800,
        primaryObjective: 'elevation_gain',
        verticalBlockJson: JSON.stringify(block),
      })
    })

    // PostgreSQL itself will reject audit INSERT. The caller-owned tx must
    // ROLLBACK the preceding UPDATE, leaving both tables unchanged.
    await sql`
      ALTER TABLE session_generation_modification_records
        ADD CONSTRAINT reject_vertical_audit CHECK (false)
    `
    await assert.rejects(
      () => sql.begin(async tx => {
        await persistVerticalPrescriptionPostgres(
          tx as unknown as RepositoryTransaction,
          {
            ...command,
            elevationGain: 900,
            verticalBlock: { ...block, coverage: 'partial' as const },
          },
        )
      }),
      /reject_vertical_audit|check constraint/i,
      'injected audit failure must abort transaction',
    )
    const state = await sql`
      SELECT elevation_gain, primary_objective, vertical_block_json
      FROM group_session_prescriptions WHERE id = 'prescription-a'
    `
    assert.equal(state.length, 1)
    assert.equal(state[0].elevation_gain, 800, 'ROLLBACK restores D+')
    assert.equal(state[0].primary_objective, 'elevation_gain')
    assert.deepEqual(JSON.parse(state[0].vertical_block_json as string), block)
    const audits = await sql`
      SELECT count(*)::integer AS count
      FROM session_generation_modification_records
    `
    assert.equal(audits[0].count, 1, 'ROLLBACK preserves exactly one committed audit')
  } finally {
    // Disconnecting drops all TEMP tables. Never DROP permanent tables or DB.
    await sql.end()
  }
})
