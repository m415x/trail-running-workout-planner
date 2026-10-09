import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const contractPath = 'docs/architecture/h6-economic-authorization-athlete-debt-guard.md'

test('KAN-714 H6 durable P7/P8 contract enumerates economic and sporting boundaries', () => {
  const contract = readFileSync(contractPath, 'utf8')

  for (const token of [
    'economic_policy.manage',
    'economy.manage',
    'createManualRealizedTrainingAction',
    'correctManualRealizedTrainingAction',
    'getCurrentAthleteTrack1000mEvidenceAction',
    'allowed',
    'blocked',
    'unavailable',
    'blockedForPriorDebt',
    'no mutation',
    'team_1',
    'T2',
    'T3',
    'T4',
    'T5',
    'T6',
    'T7',
    'T8',
    'T9',
    'T10',
  ]) {
    assert.ok(contract.includes(token), `H6 contract missing: ${token}`)
  }

  assert.match(contract, /workoutLogs/)
  assert.match(contract, /workoutLogEvidence/)
  assert.match(contract, /workoutLogCorrections/)
  assert.match(contract, /effectiveDueDate/)
  assert.match(contract, /current.month/i)
})
