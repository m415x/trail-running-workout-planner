import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseSessionPrescriptions } from '../../lib/sessions/session-prescription-parser'

test('KAN-879 RED-1 Coach form parser retains explicit vertical objective and v1 block per microcycle', () => {
  const block = {
    schemaVersion: 1,
    direction: 'ascent',
    repetitions: 3,
    coverage: 'complete',
    elevationGainPerRep: { meters: 850, provenance: { kind: 'coach_manual' } },
    elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
  }
  const form = new FormData()
  form.append('prescriptionMicrocycleId', 'week-a')
  form.set('prescriptionGroupId:week-a', 'group-a')
  form.set('distanceKm:week-a', '')
  form.set('durationMin:week-a', '')
  form.set('elevationGain:week-a', '2550')
  form.set('intensityMethod:week-a', 'hr_zone')
  form.set('zone:week-a', 'Z2')
  form.set('primaryObjective:week-a', 'elevation_gain')
  form.set('verticalBlockJson:week-a', JSON.stringify(block))

  const result = parseSessionPrescriptions(form)
  assert.equal(result.success, true)
  if (!result.success) return

  const row = result.data[0] as typeof result.data[number] & {
    primaryObjective?: string | null
    verticalBlock?: unknown
  }
  assert.equal(row.primaryObjective, 'elevation_gain',
    'Explicit Coach objective must not disappear in the Session Action parser')
  assert.deepEqual(row.verticalBlock, block,
    'Typed v1 vertical data and per-metric provenance must survive form parsing')
  assert.equal(row.elevationGain, 2550,
    'Whole-session D+ remains the effective elevation, not an added subtotal')
})
