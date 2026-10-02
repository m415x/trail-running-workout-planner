import assert from 'node:assert/strict'
import test from 'node:test'
import { createLocalSandboxPostgresClient } from '../../lib/sandbox/postgres-client'

const url = 'postgresql://postgres:synthetic-only@127.0.0.1:54322/postgres'

test('KAN-584 constructs postgres.js only for an explicitly approved local endpoint', () => {
  const calls: Array<{ url: string; options: Record<string, unknown> }> = []
  const client = { reserve: async () => ({}), end: async () => {} }
  const actual = createLocalSandboxPostgresClient({
    directUrl: url,
    postgresFactory: (target, options) => {
      calls.push({ url: target, options })
      return client
    },
  })
  assert.equal(actual, client)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, url)
  assert.equal(calls[0]?.options.max, 1)
  assert.equal(calls[0]?.options.prepare, false)
})

test('KAN-584 refuses missing/unsafe URLs before constructing the driver', () => {
  for (const directUrl of [
    undefined,
    'postgresql://postgres:secret@localhost:5432/postgres',
    'postgresql://postgres:secret@db.production.supabase.co:5432/postgres?sslmode=require',
  ]) {
    let constructed = false
    assert.throws(() => createLocalSandboxPostgresClient({
      directUrl,
      postgresFactory: () => { constructed = true; return {} },
    }), /local|sandbox|direct URL/i)
    assert.equal(constructed, false)
  }
})

test('KAN-584 normalizes driver creation errors without leaking credentials', () => {
  assert.throws(() => createLocalSandboxPostgresClient({
    directUrl: url,
    postgresFactory: () => { throw new Error('synthetic-only leaked') },
  }), (error: unknown) => error instanceof Error && !error.message.includes('synthetic-only'))
})
