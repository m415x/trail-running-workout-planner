import assert from 'node:assert/strict'
import { test } from 'node:test'

import { evaluateAuthoritativeReplay } from '@/lib/session-generation/authoritative-preview-replay'
import type { AuthoritativeGenerationRun } from '@/lib/session-generation/preview-equivalence'

test('KAN-787/T3a refuses replay when server-side input resolution is unavailable', async () => {
  let calls = 0
  const result = await evaluateAuthoritativeReplay({
    resolveRuns: async (): Promise<AuthoritativeGenerationRun[] | null> => {
      calls += 1
      return null
    },
    reviewedProposal: { events: [], warnings: [] },
    reviewedExplanations: {},
  })
  assert.equal(calls, 1)
  assert.deepEqual(result, { status: 'unavailable' })
})

test('KAN-787/T3a does not reuse client-supplied input facts as server authority', async () => {
  const result = await evaluateAuthoritativeReplay({
    resolveRuns: async () => [],
    reviewedProposal: { events: [], warnings: [] },
    reviewedExplanations: {},
  })
  assert.notEqual(result.status, 'unavailable')
})
