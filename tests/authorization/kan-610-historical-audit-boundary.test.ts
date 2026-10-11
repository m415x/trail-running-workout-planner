import assert from 'node:assert/strict'
import test from 'node:test'
import { readAuthorizedFieldPerformanceTestAuditHistory } from '../../lib/physiology/field-performance-test-application'
import type { FieldPerformanceTestRow } from '../../lib/physiology/field-performance-test-history'

test('KAN-733 audit history denies before repository reads when athlete is outside authorized scope', async () => {
  let reads = 0
  const result = await readAuthorizedFieldPerformanceTestAuditHistory(
    'cross-team-athlete',
    {
      resolveOwnedAthlete: async () => null,
      listAllByAthlete: () => {
        reads++
        throw new Error('unexpected cross-team history read')
      },
    },
  )
  assert.deepEqual(result, { success: false, error: 'athlete_not_found' })
  assert.equal(reads, 0)
})

test('KAN-733 audit history uses resolved athlete ID rather than caller-provided selector', async () => {
  const queries: string[] = []
  const result = await readAuthorizedFieldPerformanceTestAuditHistory(
    'requested-athlete',
    {
      resolveOwnedAthlete: async () => ({ id: 'authorized-athlete' }),
      listAllByAthlete: (athleteId: string): FieldPerformanceTestRow[] => {
        queries.push(athleteId)
        return []
      },
    },
  )
  assert.deepEqual(queries, ['authorized-athlete'])
  assert.deepEqual(result, { success: true, data: [] })
})
