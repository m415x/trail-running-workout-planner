import assert from 'node:assert/strict'
import test from 'node:test'
import { readAuthorizedFieldPerformanceTestAuditHistory } from '../../lib/physiology/field-performance-test-application'

test('KAN-733 audit history cannot falsely succeed after repository failure', async () => {
  let reads = 0
  await assert.rejects(
    readAuthorizedFieldPerformanceTestAuditHistory('athlete-a', {
      resolveOwnedAthlete: async () => ({ id: 'athlete-a' }),
      listAllByAthlete: () => {
        reads++
        throw new Error('sqlite audit read unavailable')
      },
    }),
    /sqlite audit read unavailable/,
  )
  assert.equal(reads, 1)
})

test('KAN-733 audit history never leaks mixed-athlete rows from an adapter', async () => {
  const result = await readAuthorizedFieldPerformanceTestAuditHistory('athlete-a', {
    resolveOwnedAthlete: async () => ({ id: 'athlete-a' }),
    listAllByAthlete: () => [
      { id: 'a', athleteId: 'athlete-a', isDeleted: true, performedAt: '2026-10-01', createdAt: '2026-10-01' },
      { id: 'b', athleteId: 'athlete-b', isDeleted: false, performedAt: '2026-10-01', createdAt: '2026-10-01' },
    ] as never,
  })
  assert.equal(result.success, true)
  if (result.success) assert.deepEqual(result.data.map(row => row.id), ['a'])
})
