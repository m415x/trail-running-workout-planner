import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { preflightAcceptanceSqlite } from '@/scripts/acceptance-dev-preflight'
import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'
import { assertAcceptanceMigrationMetadata } from '@/scripts/acceptance-dev-migration-metadata'
import { assertAcceptanceSqliteIntegrity } from '@/scripts/acceptance-dev-integrity'
import { openAcceptanceSqliteReadonly } from '@/scripts/acceptance-dev-readonly'
import {
  createScenarioWorkspace,
  removeScenarioWorkspace,
  runScenarioCommand,
} from '@/scripts/verify-sqlite-scenarios'

const projectRoot = resolve(import.meta.dirname, '../..')

test('KAN-885/T2 real disposable SQLite refuses missing H1 actor without provisioning or mutation', () => {
  const workspace = createScenarioWorkspace('base-seed')
  try {
    // Test-only fixture construction by the existing accredited scenario utility.
    // The acceptance preflight itself must never upgrade, seed or provision.
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')
    runScenarioCommand(
      workspace.root,
      process.execPath,
      [tsxCli, resolve(projectRoot, 'scripts/upgrade-sqlite.ts')],
    )

    // Prove the database really satisfies independent physical, migration and
    // integrity gates before testing the missing identity gate.
    const sqlite = openAcceptanceSqliteReadonly(workspace.sqlitePath)
    try {
      assert.doesNotThrow(() => assertAcceptancePhysicalSchema(sqlite))
      assert.doesNotThrow(() => assertAcceptanceMigrationMetadata({ sqlite, projectRoot }))
      assert.doesNotThrow(() => assertAcceptanceSqliteIntegrity(sqlite))
    } finally {
      sqlite.close()
    }

    const before = readFileSync(workspace.sqlitePath)
    // Launcher startup accredits structure only: the operator does not yet
    // have an authenticated H2 session, nor may it manufacture one.
    assert.equal(preflightAcceptanceSqlite({
      databasePath: workspace.sqlitePath,
      projectRoot,
    }), realpathSync(workspace.sqlitePath))
    assert.deepEqual(readFileSync(workspace.sqlitePath), before)

    // The existing actor-specific check remains fail-closed when an actual
    // authenticated caller explicitly requests H1 membership validation.
    const input = {
      databasePath: workspace.sqlitePath,
      projectRoot,
      subject: 'kan885-nonexistent-actor',
      teamId: 'team_1',
    }
    assert.throws(
      () => preflightAcceptanceSqlite(input),
      /H1|actor|identity|membership|supabase|team/i,
    )
    assert.deepEqual(readFileSync(workspace.sqlitePath), before)
  } finally {
    removeScenarioWorkspace(workspace)
  }
})
