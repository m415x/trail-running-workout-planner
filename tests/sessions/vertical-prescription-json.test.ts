import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

test('KAN-878 RED-1 distinguishes absent, supported, unsupported and corrupt vertical JSON', async () => {
  const modulePath = fileURLToPath(new URL('../../lib/sessions/vertical-prescription-json.ts', import.meta.url))
  assert.equal(existsSync(modulePath), true, 'KAN-878 RED-1: optional vertical JSON codec not implemented')

  const codec = await import(pathToFileURL(modulePath).href)
  assert.equal(typeof codec.readVerticalBlockJson, 'function')

  assert.deepEqual(codec.readVerticalBlockJson(null), { status: 'absent' })

  const block = {
    schemaVersion: 1,
    direction: 'ascent',
    repetitions: 3,
    coverage: 'complete',
    elevationGainPerRep: { meters: 850, provenance: { kind: 'coach_manual' } },
    elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
  }

  assert.deepEqual(
    codec.readVerticalBlockJson(JSON.stringify(block)),
    { status: 'valid', block },
    'An existing v1 block must retain the exact supported values',
  )

  assert.deepEqual(
    codec.readVerticalBlockJson(JSON.stringify({ ...block, schemaVersion: 2 })),
    { status: 'unsupported', schemaVersion: 2 },
    'Future versions are not corrupt records and must not be overwritten or normalized',
  )

  assert.deepEqual(
    codec.readVerticalBlockJson('{not json'),
    { status: 'corrupt' },
    'Malformed JSON must not be silently replaced by an absent block',
  )
})

test('KAN-878 RED-2 rejects extra keys and malformed nested fields in v1 JSON', async () => {
  const { readVerticalBlockJson } = await import('../../lib/sessions/vertical-prescription-json')

  const block = {
    schemaVersion: 1,
    direction: 'circuit',
    repetitions: 2,
    coverage: 'partial',
    elevationGainPerRep: { meters: 500, provenance: { kind: 'coach_manual' } },
    elevationLossPerRep: {
      meters: 420,
      provenance: { kind: 'track_adopted', trackReference: 'track-team-1' },
    },
  }
  const corrupt = { status: 'corrupt' as const }

  assert.deepEqual(
    readVerticalBlockJson(JSON.stringify({ ...block, unexpectedField: 'discard-me' })),
    corrupt,
    'An unrecognized top-level key must not be discarded from a v1 payload',
  )

  assert.deepEqual(
    readVerticalBlockJson(JSON.stringify({
      ...block,
      elevationGainPerRep: { ...block.elevationGainPerRep, extraMeters: 10 },
    })),
    corrupt,
    'An unrecognized metric key must fail closed',
  )

  assert.deepEqual(
    readVerticalBlockJson(JSON.stringify({
      ...block,
      elevationLossPerRep: {
        ...block.elevationLossPerRep,
        provenance: { ...block.elevationLossPerRep.provenance, athleteId: 'untrusted' },
      },
    })),
    corrupt,
    'An unrecognized provenance key must fail closed',
  )

  assert.deepEqual(
    readVerticalBlockJson(JSON.stringify({
      ...block,
      elevationLossPerRep: null,
    })),
    corrupt,
    'A required metric object cannot be null',
  )

  assert.deepEqual(
    readVerticalBlockJson(JSON.stringify({
      ...block,
      elevationGainPerRep: { meters: 500, provenance: { kind: 'coach_manual', trackReference: 'wrong' } },
    })),
    corrupt,
    'Manual provenance cannot contain track-specific fields',
  )

  assert.deepEqual(
    readVerticalBlockJson(JSON.stringify({
      ...block,
      elevationGainPerRep: { meters: null, provenance: { kind: 'unknown' } },
    })),
    { status: 'valid', block: { ...block, elevationGainPerRep: { meters: null, provenance: { kind: 'unknown' } } } },
    'A genuinely unknown metric remains valid and distinct from zero',
  )
})
