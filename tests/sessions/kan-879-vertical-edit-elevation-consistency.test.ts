import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const complete = {
  schemaVersion: 1,
  direction: 'ascent',
  repetitions: 2,
  coverage: 'complete',
  elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
}
const partial = { ...complete, coverage: 'partial' }

test('KAN-879 RED-5 final session D+ must remain consistent with retained vertical block on a changed dose', async () => {
  const path = fileURLToPath(new URL('../../lib/sessions/session-vertical-edit-fields.ts', import.meta.url))
  const imported = await import(pathToFileURL(path).href).catch(() => ({}))
  const validate = Reflect.get(imported, 'assertVerticalEditElevationConsistency') as
    | ((input: {
        previousElevationGain: number | null
        nextElevationGain: number | null
        verticalBlockJson: string | null
      }) => void)
    | undefined
  assert.equal(typeof validate, 'function', 'RED-5: final D+ edit consistency guard is missing')
  if (!validate) return

  assert.doesNotThrow(() => validate({
    previousElevationGain: 800,
    nextElevationGain: 800,
    verticalBlockJson: JSON.stringify(complete),
  }), 'Legacy-only edit with unchanged D+ must remain valid')

  assert.throws(() => validate({
    previousElevationGain: 800,
    nextElevationGain: 900,
    verticalBlockJson: JSON.stringify(complete),
  }), /complete|elevation|vertical/i,
  'Complete block of 2 x 400 m cannot coexist with edited session D+ of 900 m')

  assert.throws(() => validate({
    previousElevationGain: 900,
    nextElevationGain: 700,
    verticalBlockJson: JSON.stringify(partial),
  }), /partial|subtotal|elevation|vertical/i,
  'Partial known vertical subtotal of 800 m cannot exceed edited whole-session D+ of 700 m')

  assert.doesNotThrow(() => validate({
    previousElevationGain: 900,
    nextElevationGain: 1000,
    verticalBlockJson: JSON.stringify(partial),
  }), 'Partial subtotal may be below a known whole-session D+')

  const futureBytes = '{"schemaVersion":999,"unknown":"retain unchanged"}'
  assert.doesNotThrow(() => validate({
    previousElevationGain: 800,
    nextElevationGain: 800,
    verticalBlockJson: futureBytes,
  }), 'Unchanged legacy edit must not rewrite or reject opaque future version bytes')

  assert.throws(() => validate({
    previousElevationGain: 800,
    nextElevationGain: 900,
    verticalBlockJson: futureBytes,
  }), /unsupported|version|vertical/i,
  'Changing D+ with an opaque future block must fail closed')

  assert.throws(() => validate({
    previousElevationGain: 800,
    nextElevationGain: 900,
    verticalBlockJson: '{corrupt',
  }), /corrupt|vertical|invalid/i,
  'Changing D+ with corrupt persisted vertical JSON must fail closed')

  assert.doesNotThrow(() => validate({
    previousElevationGain: 800,
    nextElevationGain: 900,
    verticalBlockJson: null,
  }), 'Legacy prescription without vertical block may update session D+')
})
