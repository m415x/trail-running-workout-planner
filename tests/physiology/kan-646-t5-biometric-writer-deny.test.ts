import assert from 'node:assert/strict'
import test from 'node:test'

import { createBiometricSelfWriter } from '@/lib/physiology/biometric-self-writer'

const valid = {
  kind: 'weight', unit: 'kg', value: '72.5',
  observedOn: '2026-10-17', operationKey: 'op_a',
} as const

test('KAN-646/T5 DENY never invokes persistence, even for valid biometric input', async () => {
  let persisted = 0
  const writer = createBiometricSelfWriter({
    authorize: async () => ({ status: 'denied' as const }),
    persist: async () => { persisted++; throw new Error('must not persist') },
    today: () => '2026-10-17',
  })
  assert.deepEqual(await writer.create(valid), { status: 'denied' })
  assert.equal(persisted, 0)
})

test('KAN-646/T5 validation refuses malformed values and dates before calling persistence', async () => {
  let persisted = 0
  const writer = createBiometricSelfWriter({
    authorize: async () => ({ status: 'resolved' as const, userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' }),
    persist: async () => { persisted++; throw new Error('must not persist') },
    today: () => '2026-10-17',
  })
  for (const input of [
    { ...valid, value: '72.55' },
    { ...valid, kind: 'medical' },
    { ...valid, observedOn: '2026-09-16' },
    { ...valid, observedOn: '2026-10-18' },
  ]) {
    assert.deepEqual(await writer.create(input), { status: 'invalid' })
  }
  assert.equal(persisted, 0)
})
