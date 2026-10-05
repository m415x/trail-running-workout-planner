import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAthleteNameWriteIntent } from '../../features/athletes/lib/athlete-name-write-intent'

test('KAN-623 preserves legacy fallback names when the edit leaves them unchanged', () => {
  assert.equal(resolveAthleteNameWriteIntent(
    { firstName: 'Ana', lastName: 'Acosta' },
    { firstName: 'Ana', lastName: 'Acosta' },
  ), 'preserve')
})

test('KAN-623 replaces names when either administrative name is explicitly changed', () => {
  assert.equal(resolveAthleteNameWriteIntent(
    { firstName: 'Ana', lastName: 'Acosta' },
    { firstName: 'Ana', lastName: 'Acosta Prueba' },
  ), 'replace')
  assert.equal(resolveAthleteNameWriteIntent(
    { firstName: 'Ana', lastName: 'Acosta' },
    { firstName: 'Ana María', lastName: 'Acosta' },
  ), 'replace')
})
