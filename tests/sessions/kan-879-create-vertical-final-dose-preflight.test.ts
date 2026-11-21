import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { preflightVerticalSessionEdits } from '../../lib/sessions/session-vertical-edit-preflight'
import type { VerticalBlockV1 } from '../../lib/sessions/vertical-prescription'

const complete: VerticalBlockV1 = {
  schemaVersion: 1,
  direction: 'ascent',
  repetitions: 2,
  coverage: 'complete',
  elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
}

test('KAN-879 RED-8 create preflight rejects contradictory complete D+ and allows consistent dose', () => {
  assert.throws(() => preflightVerticalSessionEdits({
    previous: [],
    edits: [{ microcycleId: 'week-a', elevationGain: 900, verticalBlock: complete }],
  }), /complete|elevation|vertical/i)

  assert.doesNotThrow(() => preflightVerticalSessionEdits({
    previous: [],
    edits: [{ microcycleId: 'week-a', elevationGain: 800, verticalBlock: complete }],
  }))
})

test('KAN-879 RED-8 createSession validates ALL vertical prescriptions before first insert', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  const start = source.indexOf('export async function createSession(')
  const end = source.indexOf('export async function updateSession(', start)
  assert.ok(start >= 0 && end > start)
  const create = source.slice(start, end)

  assert.match(create,
    /planningAccess\.authorizeGroup\(groupId\)/,
    'Server-owned H2/H3/H4A planning.manage group guard must remain')
  assert.match(create, /validatePrescriptionReferences\(prescriptions\.data, data\.date, planningAccess\.teamId\)/,
    'Team/Group/Plan/Microcycle reference checks must remain')
  const check = create.indexOf('preflightVerticalSessionEdits(')
  const firstWrite = create.indexOf('tx.insert(sessions)')
  const secondWrite = create.indexOf('tx.insert(groupSessionPrescriptions)')
  assert.ok(check >= 0 && check < firstWrite && check < secondWrite,
    'New Session creation must run shared full-dose preflight before any durable insert')
  assert.match(create.slice(check, check + 190), /previous:\s*\[\s*\]/,
    'Create has no previous persisted prescriptions')
  assert.match(create.slice(check, check + 210), /edits:\s*prescriptions\.data/,
    'Validate submitted vertical blocks rather than dummy fixtures')
})
