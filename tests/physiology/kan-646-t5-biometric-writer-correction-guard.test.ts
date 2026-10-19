import assert from 'node:assert/strict'
import test from 'node:test'

import { createBiometricSelfWriter } from '@/lib/physiology/biometric-self-writer'

const subject = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const base = {
  kind: 'weight', unit: 'kg', value: '72.5', observedOn: '2026-10-17',
  operationKey: 'correct_1', supersedesObservationId: 'original_1', correctionReason: 'Correction of entry',
}

test('KAN-646/T5 correction input validation rejects missing target/reason before persistence', async () => {
  let writes = 0
  const writer = createBiometricSelfWriter({
    authorize: async () => subject,
    today: () => '2026-10-17',
    persist: async () => ({ status: 'created' as const, id: 'new' }),
    correct: async () => { writes++; return { status: 'created' as const, id: 'successor' } },
  })
  assert.deepEqual(await writer.correct({ ...base, supersedesObservationId: '' }), { status: 'invalid' })
  assert.deepEqual(await writer.correct({ ...base, correctionReason: '   ' }), { status: 'invalid' })
  assert.deepEqual(await writer.correct({ ...base, observedOn: '2026-11-01' }), { status: 'invalid' })
  assert.equal(writes, 0)
})

test('KAN-646/T5 correction respects H2/H3 deny and never calls repository', async () => {
  let writes = 0
  const writer = createBiometricSelfWriter({
    authorize: async () => ({ status: 'denied' as const }),
    today: () => '2026-10-17',
    persist: async () => ({ status: 'created' as const, id: 'new' }),
    correct: async () => { writes++; return { status: 'created' as const, id: 'successor' } },
  })
  assert.deepEqual(await writer.correct(base), { status: 'denied' })
  assert.equal(writes, 0)
})
