import assert from 'node:assert/strict'
import test from 'node:test'

import { readApprovedLocalSandboxPin } from '../../lib/sandbox/local-cluster-pin'

const trustedDocument = JSON.stringify({
  kind: 'coach-supabase-local',
  projectId: 'trail-running-workout-planner',
  approvedClusterSystemIdentifier: '7692192345457819685',
  approvedByOperator: true,
})

test('KAN-585 loads an explicitly approved local pin from a caller-supplied protected source', async () => {
  let reads = 0
  const pin = await readApprovedLocalSandboxPin({
    readTrustedDocument: async () => { reads++; return trustedDocument },
  })
  assert.equal(pin, '7692192345457819685')
  assert.equal(reads, 1)
})

test('KAN-585 denies a missing explicit operator approval or a copied SQL row', async () => {
  for (const document of [
    JSON.stringify({ kind: 'coach-supabase-local', projectId: 'trail-running-workout-planner', approvedClusterSystemIdentifier: '7692192345457819685' }),
    JSON.stringify({ kind: 'coach-supabase-local', projectId: 'trail-running-workout-planner', approvedClusterSystemIdentifier: '7692192345457819685', approvedByOperator: false }),
    JSON.stringify({ database: 'postgres', clusterSystemIdentifier: '7692192345457819685', environmentMarker: 'trail-running-coach-local-sandbox' }),
    JSON.stringify({ kind: 'coach-supabase-local', projectId: 'different-project', approvedClusterSystemIdentifier: '7692192345457819685', approvedByOperator: true }),
  ]) {
    await assert.rejects(
      () => readApprovedLocalSandboxPin({ readTrustedDocument: async () => document }),
      /pin|approval|trusted/i,
    )
  }
})

test('KAN-585 fails closed without a trusted document and redacts read errors', async () => {
  await assert.rejects(
    () => readApprovedLocalSandboxPin({ readTrustedDocument: async () => { throw new Error('password=SECRET') } }),
    (error: unknown) => error instanceof Error
      && /trusted|pin|approval/i.test(error.message)
      && !error.message.includes('SECRET'),
  )
})
