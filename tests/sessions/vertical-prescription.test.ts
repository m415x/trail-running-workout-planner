import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

test('KAN-877 RED-1 calculates three ascents without inferring unknown descent or distance', async () => {
  const modulePath = fileURLToPath(new URL('../../lib/sessions/vertical-prescription.ts', import.meta.url))

  assert.equal(
    existsSync(modulePath),
    true,
    'KAN-877 RED-1: the pure vertical-prescription calculator module has not been implemented',
  )

  const moduleUrl = pathToFileURL(modulePath).href
  const moduleExports = await import(moduleUrl)
  const calculator = moduleExports.calculateVerticalBlockTotals

  assert.equal(
    typeof calculator,
    'function',
    'KAN-877 RED-1: calculateVerticalBlockTotals must be exported as a pure function',
  )

  const result = calculator({
    schemaVersion: 1,
    direction: 'ascent',
    repetitions: 3,
    coverage: 'complete',
    elevationGainPerRep: {
      meters: 850,
      provenance: { kind: 'coach_manual' },
    },
    elevationLossPerRep: {
      meters: null,
      provenance: { kind: 'unknown' },
    },
  })

  assert.deepEqual(
    result,
    {
      elevationGainTotalM: 2550,
      elevationLossTotalM: null,
    },
    'Three 850 m ascents produce 2550 m D+; unknown D- stays null and distance is not inferred',
  )
})

test('KAN-877 RED-2 respects directed ascent, descent and circuit metrics and rejects unsupported directions', async () => {
  const { calculateVerticalBlockTotals } = await import('../../lib/sessions/vertical-prescription')

  const base = {
    schemaVersion: 1 as const,
    repetitions: 2,
    coverage: 'complete' as const,
  }
  const knownGain = {
    meters: 500,
    provenance: { kind: 'coach_manual' as const },
  }
  const knownLoss = {
    meters: 430,
    provenance: { kind: 'coach_manual' as const },
  }
  const unknown = {
    meters: null,
    provenance: { kind: 'unknown' as const },
  }

  assert.deepEqual(calculateVerticalBlockTotals({
    ...base,
    direction: 'ascent',
    elevationGainPerRep: knownGain,
    elevationLossPerRep: unknown,
  }), { elevationGainTotalM: 1000, elevationLossTotalM: null })

  assert.deepEqual(calculateVerticalBlockTotals({
    ...base,
    direction: 'descent',
    elevationGainPerRep: unknown,
    elevationLossPerRep: knownLoss,
  }), { elevationGainTotalM: null, elevationLossTotalM: 860 })

  assert.deepEqual(calculateVerticalBlockTotals({
    ...base,
    direction: 'circuit',
    elevationGainPerRep: knownGain,
    elevationLossPerRep: knownLoss,
  }), { elevationGainTotalM: 1000, elevationLossTotalM: 860 })

  const unsupportedDirection = {
    ...base,
    direction: 'reverse',
    elevationGainPerRep: knownGain,
    elevationLossPerRep: knownLoss,
  }

  assert.throws(
    () => calculateVerticalBlockTotals(unsupportedDirection as unknown as Parameters<typeof calculateVerticalBlockTotals>[0]),
    RangeError,
    'A runtime-invalid direction must not be silently accepted as a valid directed repetition',
  )
})

test('KAN-877 RED-3 validates independent D+ and D- provenance without fabricating unknown values', async () => {
  const { calculateVerticalBlockTotals } = await import('../../lib/sessions/vertical-prescription')
  type Block = Parameters<typeof calculateVerticalBlockTotals>[0]

  const block: Block = {
    schemaVersion: 1,
    direction: 'circuit',
    repetitions: 2,
    coverage: 'partial',
    elevationGainPerRep: {
      meters: 500,
      provenance: { kind: 'coach_manual' },
    },
    elevationLossPerRep: {
      meters: 430,
      provenance: { kind: 'track_adopted', trackReference: 'track-team-1' },
    },
  }

  assert.deepEqual(calculateVerticalBlockTotals(block), {
    elevationGainTotalM: 1000,
    elevationLossTotalM: 860,
  }, 'D+ and D- retain independently supplied values, regardless of origin')

  assert.throws(() => calculateVerticalBlockTotals({
    ...block,
    elevationGainPerRep: {
      meters: 500,
      provenance: { kind: 'unknown' },
    },
  }), RangeError, 'An unknown D+ origin cannot describe a known D+ value')

  assert.throws(() => calculateVerticalBlockTotals({
    ...block,
    elevationLossPerRep: {
      meters: null,
      provenance: { kind: 'track_adopted', trackReference: 'track-team-1' },
    },
  }), RangeError, 'A null metric must have unknown provenance')

  assert.throws(() => calculateVerticalBlockTotals({
    ...block,
    elevationLossPerRep: {
      meters: 430,
      provenance: { kind: 'track_adopted', trackReference: '   ' },
    },
  }), RangeError, 'Adopted track provenance requires a non-blank technical reference')
})
