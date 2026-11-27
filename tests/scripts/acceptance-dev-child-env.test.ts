import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const modulePath = resolve(root, 'scripts/acceptance-dev-child-env.ts')

test('KAN-885/T3 constructs an isolated acceptance Next child environment', async () => {
  assert.equal(existsSync(modulePath), true, 'dedicated child environment builder must exist')
  const { buildAcceptanceDevChildEnv } = await import('../../scripts/acceptance-dev-child-env')
  const inherited = {
    PATH: 'test-path',
    HOME: 'test-home',
    SQLITE_DATABASE_PATH: '/old/developer.db',
    SQLITE_SCENARIO_MODE: '0',
    SQLITE_SEED_DISPOSABLE_ACK: '1',
    SQLITE_SEED_ALLOW_NON_DISPOSABLE: '1',
    EPT_IDENTITY_BACKEND: 'postgres',
    TSX_TSCONFIG_PATH: '/foreign/tsconfig.json',
    ACCEPTANCE_RUNTIME_TOKEN: 'must-not-copy',
  }
  const databasePath = '/canonical/disposable/acceptance.db'
  const child = buildAcceptanceDevChildEnv({
    inheritedEnv: inherited,
    databasePath,
    projectRoot: root,
  })

  assert.equal(child.SQLITE_DATABASE_PATH, databasePath)
  assert.equal(child.SQLITE_SCENARIO_MODE, '1')
  assert.equal(child.EPT_IDENTITY_BACKEND, 'sqlite')
  assert.equal(child.TSX_TSCONFIG_PATH, resolve(root, 'tsconfig.json'))
  assert.equal(child.PATH, inherited.PATH)
  assert.equal(child.HOME, inherited.HOME)
  assert.equal(child.SQLITE_SEED_DISPOSABLE_ACK, undefined)
  assert.equal(child.SQLITE_SEED_ALLOW_NON_DISPOSABLE, undefined)
  assert.equal(child.ACCEPTANCE_RUNTIME_TOKEN, undefined)
  assert.equal(inherited.SQLITE_DATABASE_PATH, '/old/developer.db',
    'parent env must remain unchanged')
  assert.equal(inherited.SQLITE_SEED_DISPOSABLE_ACK, '1')
})

test('KAN-885/T3 child env requires explicit accredited database path input', async () => {
  assert.equal(existsSync(modulePath), true, 'dedicated child environment builder must exist')
  const { buildAcceptanceDevChildEnv } = await import('../../scripts/acceptance-dev-child-env')
  assert.throws(
    () => buildAcceptanceDevChildEnv({ inheritedEnv: {}, databasePath: '', projectRoot: root }),
    /database|path|accredit|missing/i,
  )
})
