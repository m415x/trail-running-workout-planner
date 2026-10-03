import assert from 'node:assert/strict'
import test from 'node:test'

import { runCoachSandboxOperation } from '../../scripts/coach-sandbox-db'

const localUrl = 'postgresql://postgres:synthetic-placeholder@127.0.0.1:54322/postgres'

test('KAN-584 never opens a connection for missing, cloud or unsafe destinations', async () => {
  for (const url of [
    undefined,
    'postgresql://postgres:secret@db.production.supabase.co:5432/postgres?sslmode=require',
    'postgresql://postgres:secret@localhost:5432/postgres',
  ]) {
    let opens = 0
    await assert.rejects(
      () => runCoachSandboxOperation({
        operation: 'migrate',
    confirmation: 'migrate',
        directUrl: url,
        open: async () => { opens++; return {} },
        identify: async () => ({
          database: 'postgres',
          environmentMarker: 'trail-running-coach-local-sandbox',
          projectRef: null,
        }),
        execute: async () => 'unexpected',
        close: async () => {},
      }),
      /sandbox|direct URL|local/i,
    )
    assert.equal(opens, 0)
  }
})

test('KAN-584 rejects reset and invalid commands before touching the database', async () => {
  for (const operation of ['reset', 'drop-schema'] as const) {
    let opened = false
    await assert.rejects(
      () => runCoachSandboxOperation({
        operation,
        directUrl: localUrl,
        open: async () => { opened = true; return {} },
        identify: async () => ({
          database: 'postgres',
          environmentMarker: 'trail-running-coach-local-sandbox',
          projectRef: null,
        }),
        execute: async () => 'unexpected',
        close: async () => {},
      }),
      /reset|operation/i,
    )
    assert.equal(opened, false)
  }
})

test('KAN-584 permits an explicitly verified local operation through the guarded entrypoint', async () => {
  const observed: string[] = []
  const session = { id: 'one-session' }
  const result = await runCoachSandboxOperation({
    operation: 'seed',
    confirmation: 'seed',
    directUrl: localUrl,
    open: async () => { observed.push('open'); return session },
    identify: async (connection) => {
      assert.equal(connection, session)
      observed.push('identity')
      return {
        database: 'postgres',
        environmentMarker: 'trail-running-coach-local-sandbox',
        projectRef: null,
      }
    },
    execute: async (connection) => {
      assert.equal(connection, session)
      observed.push('execute')
      return 'ok'
    },
    close: async (connection) => {
      assert.equal(connection, session)
      observed.push('close')
    },
  })
  assert.equal(result, 'ok')
  assert.deepEqual(observed, ['open', 'identity', 'execute', 'close'])
})
