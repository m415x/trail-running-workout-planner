import assert from 'node:assert/strict'
import test from 'node:test'

import { inspectSandboxDestination } from '../../lib/sandbox/sandbox-destination'

const localUrl = 'postgresql://postgres:synthetic-secret@127.0.0.1:54322/postgres'

test('KAN-583 requires an explicit sandbox kind and direct database URL', () => {
  assert.throws(() => inspectSandboxDestination({ kind: undefined, directUrl: localUrl }), /sandbox kind/i)
  assert.throws(() => inspectSandboxDestination({ kind: 'local', directUrl: undefined }), /direct URL/i)
  assert.throws(() => inspectSandboxDestination({ kind: 'production', directUrl: localUrl }), /sandbox kind/i)
})

test('KAN-583 permits only the canonical local Supabase database endpoint', () => {
  assert.deepEqual(inspectSandboxDestination({ kind: 'local', directUrl: localUrl }), {
    kind: 'local',
    host: '127.0.0.1',
    port: 54322,
    database: 'postgres',
  })
  for (const url of [
    'postgresql://postgres:secret@localhost:5432/postgres',
    'postgresql://postgres:secret@127.0.0.1:5432/postgres',
    'postgresql://postgres:secret@192.168.0.10:54322/postgres',
    'postgresql://postgres:secret@db.production.supabase.co:5432/postgres?sslmode=require',
    'postgresql://postgres:secret@127.0.0.1:54322/production',
    'postgresql://superuser:secret@127.0.0.1:54322/postgres',
  ]) {
    assert.throws(() => inspectSandboxDestination({ kind: 'local', directUrl: url }), /local sandbox endpoint/i)
  }
})

test('KAN-583 denies cloud hosts without explicit exact project allowlist', () => {
  const url = 'postgresql://postgres:synthetic-secret@db.sandboxref123.supabase.co:5432/postgres?sslmode=require'
  assert.throws(() => inspectSandboxDestination({ kind: 'cloud', directUrl: url }), /project allowlist/i)
  assert.throws(() => inspectSandboxDestination({
    kind: 'cloud', directUrl: url, allowedCloudProjectRefs: ['otherref123'],
  }), /cloud sandbox endpoint/i)
  assert.deepEqual(inspectSandboxDestination({
    kind: 'cloud', directUrl: url, allowedCloudProjectRefs: ['sandboxref123'],
  }), {
    kind: 'cloud',
    host: 'db.sandboxref123.supabase.co',
    port: 5432,
    database: 'postgres',
    projectRef: 'sandboxref123',
  })
})

test('KAN-583 rejects cloud URL tricks and never prints credentials in errors', () => {
  const credential = 'DO_NOT_LEAK_SECRET'
  const urls = [
    'postgresql://postgres:' + credential + '@db.sandboxref123.supabase.co.evil.test:5432/postgres?sslmode=require',
    'postgresql://postgres:' + credential + '@db.sandboxref123.supabase.co:5432/postgres?sslmode=disable',
    'postgresql://postgres:' + credential + '@db.sandboxref123.supabase.co:5432/postgres?sslmode=require&options=-c',
    'postgresql://postgres:' + credential + '@db.sandboxref123.supabase.co:6432/postgres?sslmode=require',
  ]
  for (const directUrl of urls) {
    assert.throws(() => inspectSandboxDestination({
      kind: 'cloud', directUrl, allowedCloudProjectRefs: ['sandboxref123'],
    }), (error: unknown) => error instanceof Error && !error.message.includes(credential))
  }
})
