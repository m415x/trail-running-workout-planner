import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { runVerifiedRepositoryDrizzleMigrationTransaction } from '../../lib/sandbox/verified-drizzle-migration-runner'

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const marker = 'trail-running-coach-local-sandbox'

function fakeDatabase(physical = pin) {
  const events: string[] = []
  const session = { identifier: 'pinned-drizzle-transaction' }
  const database = {
    dialect: {
      migrate: async (
        migrations: readonly { sql: string[]; hash: string; folderMillis: number; bps: boolean }[],
        receivedSession: typeof session,
        config: { migrationsFolder: string },
      ) => {
        events.push('MIGRATE')
        assert.equal(receivedSession, session)
        assert.equal(migrations.length, 29)
        assert.equal(config.migrationsFolder, resolve(process.cwd(), 'drizzle/supabase'))
      },
    },
    transaction: async (callback: (transaction: {
      session: typeof session
      execute: (statement: string) => Promise<Record<string, string | null>[]>
    }) => Promise<void>) => {
      events.push('BEGIN')
      try {
        await callback({
          session,
          execute: async statement => {
            if (statement.includes('pg_control_system()')) {
              events.push('PIN')
              return [{ database: 'postgres', clusterSystemIdentifier: physical }]
            }
            if (statement.includes('set_config(')) {
              events.push('MARKER')
              return [{ environmentMarker: marker }]
            }
            if (statement.includes('current_setting(')) {
              events.push('READBACK')
              return [{ environmentMarker: marker }]
            }
            if (statement.includes('to_regclass(')) {
              events.push('JOURNAL')
              return [{ journal: null }]
            }
            if (statement.includes('pg_catalog.pg_class')) {
              events.push('COLLISIONS')
              return []
            }
            throw new Error('Unexpected SQL')
          },
        })
        events.push('COMMIT')
      } catch (error) {
        events.push('ROLLBACK')
        throw error
      }
    },
  }
  return { events, database }
}

test('KAN-585 passes only canonical repository SQL and Drizzle migration metadata into pinned transaction', async () => {
  const f = fakeDatabase()
  await runVerifiedRepositoryDrizzleMigrationTransaction({
    repositoryRoot: process.cwd(),
    directUrl: localUrl,
    expectedClusterSystemIdentifier: pin,
    database: f.database,
  })
  assert.deepEqual(f.events, [
    'BEGIN', 'PIN', 'MARKER', 'READBACK', 'JOURNAL', 'COLLISIONS', 'MIGRATE', 'COMMIT',
  ])
})

test('KAN-585 rejects a foreign repository journal without starting DB transaction', async () => {
  const f = fakeDatabase()
  await assert.rejects(
    () => runVerifiedRepositoryDrizzleMigrationTransaction({
      repositoryRoot: resolve(process.cwd(), 'tests/sandbox'),
      directUrl: localUrl,
      expectedClusterSystemIdentifier: pin,
      database: f.database,
    }),
    /journal|canonical|migration|directory|SQL/i,
  )
  assert.deepEqual(f.events, [])
})

test('KAN-585 refuses wrong physical cluster before migrating any repository SQL', async () => {
  const f = fakeDatabase('other-cluster')
  await assert.rejects(
    () => runVerifiedRepositoryDrizzleMigrationTransaction({
      repositoryRoot: process.cwd(),
      directUrl: localUrl,
      expectedClusterSystemIdentifier: pin,
      database: f.database,
    }),
    /cluster|physical|identity/i,
  )
  assert.deepEqual(f.events, ['BEGIN', 'PIN', 'ROLLBACK'])
})
