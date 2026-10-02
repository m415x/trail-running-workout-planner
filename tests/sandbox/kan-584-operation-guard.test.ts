import assert from 'node:assert/strict'
import test from 'node:test'

import { authorizeSandboxMutation } from '../../lib/sandbox/sandbox-operation-guard'

const local = {
  kind: 'local' as const,
  directUrl: 'postgresql://postgres:fake-only@127.0.0.1:54322/postgres',
}

const verifiedLocal = async () => ({
  database: 'postgres',
  environmentMarker: 'trail-running-coach-local-sandbox',
  projectRef: null,
})

test('KAN-584 refuses mutation before checking physical database identity', async () => {
  let mutationCalls = 0
  await assert.rejects(
    () => authorizeSandboxMutation({
      destination: local,
      operation: 'seed',
      readPhysicalIdentity: async () => {
        throw new Error('identity unavailable')
      },
      execute: async () => { mutationCalls++ },
    }),
    /identity/i,
  )
  assert.equal(mutationCalls, 0)
})

test('KAN-584 refuses mismatched or missing physical sandbox markers', async () => {
  for (const environmentMarker of [undefined, 'production', 'trail-running-coach-cloud-sandbox']) {
    let mutationCalls = 0
    await assert.rejects(() => authorizeSandboxMutation({
      destination: local,
      operation: 'migrate',
      readPhysicalIdentity: async () => ({
        database: 'postgres', environmentMarker, projectRef: null,
      }),
      execute: async () => { mutationCalls++ },
    }), /identity|marker/i)
    assert.equal(mutationCalls, 0)
  }
})

test('KAN-584 refuses unapproved cloud mutations even with a matching URL and marker', async () => {
  let mutationCalls = 0
  await assert.rejects(() => authorizeSandboxMutation({
    destination: {
      kind: 'cloud',
      directUrl: 'postgresql://postgres:fake-only@db.sandboxref123.supabase.co:5432/postgres?sslmode=require',
      allowedCloudProjectRefs: ['sandboxref123'],
    },
    operation: 'migrate',
    readPhysicalIdentity: async () => ({
      database: 'postgres',
      environmentMarker: 'trail-running-coach-cloud-sandbox',
      projectRef: 'sandboxref123',
    }),
    execute: async () => { mutationCalls++ },
  }), /cloud.*not authorized/i)
  assert.equal(mutationCalls, 0)
})

test('KAN-584 requires explicit confirmation for local destructive reset', async () => {
  let mutationCalls = 0
  await assert.rejects(() => authorizeSandboxMutation({
    destination: local,
    operation: 'reset',
    readPhysicalIdentity: verifiedLocal,
    execute: async () => { mutationCalls++ },
  }), /reset confirmation/i)
  assert.equal(mutationCalls, 0)
})

test('KAN-584 executes one local synthetic seed only after identity and allowed operation checks', async () => {
  const order: string[] = []
  const result = await authorizeSandboxMutation({
    destination: local,
    operation: 'seed',
    readPhysicalIdentity: async () => {
      order.push('identity')
      return verifiedLocal()
    },
    execute: async () => {
      order.push('mutation')
      return 'seed complete'
    },
  })
  assert.equal(result, 'seed complete')
  assert.deepEqual(order, ['identity', 'mutation'])
})

test('KAN-584 rejects mismatched database and nonlocal project identities', async () => {
  for (const candidate of [
    { database: 'production', environmentMarker: 'trail-running-coach-local-sandbox', projectRef: null },
    { database: 'postgres', environmentMarker: 'trail-running-coach-local-sandbox', projectRef: 'another-project' },
    { database: 'postgres', environmentMarker: 'trail-running-coach-local-sandbox' },
  ]) {
    let executed = false
    await assert.rejects(
      authorizeSandboxMutation({
        destination: local,
        operation: 'seed',
        readPhysicalIdentity: async () => candidate,
        execute: async () => { executed = true },
      }),
      /identity/i,
    )
    assert.equal(executed, false)
  }
})

test('KAN-584 never exposes a credential from physical identity lookup errors', async () => {
  const secret = 'MUST_NOT_APPEAR_IN_EXCEPTION'
  await assert.rejects(
    authorizeSandboxMutation({
      destination: local,
      operation: 'seed',
      readPhysicalIdentity: async () => {
        throw new Error('connection failed: ' + secret)
      },
      execute: async () => 'unexpected',
    }),
    (error: unknown) => error instanceof Error
      && /identity/i.test(error.message)
      && !error.message.includes(secret),
  )
})

test('KAN-584 cannot be bypassed with an unknown mutation operation', async () => {
  let executed = false
  await assert.rejects(
    authorizeSandboxMutation({
      destination: local,
      operation: 'drop_everything' as 'migrate',
      readPhysicalIdentity: verifiedLocal,
      execute: async () => { executed = true },
    }),
    /operation/i,
  )
  assert.equal(executed, false)
})
