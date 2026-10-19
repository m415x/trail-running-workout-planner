import assert from 'node:assert/strict'
import test from 'node:test'

import { createBiometricSelfWriter } from '@/lib/physiology/biometric-self-writer'

const subject = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const input = { kind: 'weight', unit: 'kg', value: '72.5', observedOn: '2026-10-17', operationKey: 'op_a' }

test('KAN-646/T5 operation-key payload conflict must not be reported as persisted', async () => {
  let attempts = 0
  const writer = createBiometricSelfWriter({
    authorize: async () => subject,
    today: () => '2026-10-17',
    persist: async () => { attempts++; return { status: 'conflict' as const } },
  })
  assert.deepEqual(await writer.create(input), { status: 'conflict' })
  assert.equal(attempts, 1)
})

test('KAN-646/T5 an identical idempotent replay remains distinct from a new creation', async () => {
  const writer = createBiometricSelfWriter({
    authorize: async () => subject,
    today: () => '2026-10-17',
    persist: async () => ({ status: 'replayed' as const, id: 'existing_observation' }),
  })
  assert.deepEqual(await writer.create(input), {
    status: 'persisted',
    result: { status: 'replayed', id: 'existing_observation' },
  })
})
