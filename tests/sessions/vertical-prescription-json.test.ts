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

test('KAN-878 RED-3 serializes only valid optional v1 JSON within 4096 UTF-8 bytes', async () => {
  const codec = await import('../../lib/sessions/vertical-prescription-json')
  const writeVerticalBlockJson = Reflect.get(codec, 'writeVerticalBlockJson')

  assert.equal(
    typeof writeVerticalBlockJson,
    'function',
    'KAN-878 RED-3: the guarded v1 JSON writer is missing',
  )

  type Block = NonNullable<Extract<ReturnType<typeof codec.readVerticalBlockJson>, { status: 'valid' }>['block']>
  const block: Block = {
    schemaVersion: 1,
    direction: 'circuit',
    repetitions: 2,
    coverage: 'partial',
    elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
    elevationLossPerRep: {
      meters: 350,
      provenance: { kind: 'track_adopted', trackReference: 'track-team-1' },
    },
  }

  assert.equal(writeVerticalBlockJson(null), null, 'An absent optional block stays SQL NULL')
  const encoded = writeVerticalBlockJson(block)
  assert.ok(typeof encoded === 'string', 'A present v1 block must serialize to a string')
  assert.deepEqual(codec.readVerticalBlockJson(encoded), { status: 'valid', block })
  assert.ok(Buffer.byteLength(encoded, 'utf8') <= 4096)

  const largeTrackRef = 'ñ'.repeat(2000)
  const oversized: Block = {
    ...block,
    elevationLossPerRep: {
      meters: 350,
      provenance: { kind: 'track_adopted', trackReference: largeTrackRef },
    },
  }
  const largeJson = JSON.stringify(oversized)
  assert.ok(largeJson.length < 4096, 'The fixture must fit under 4096 JS code units')
  assert.ok(Buffer.byteLength(largeJson, 'utf8') > 4096, 'The fixture must exceed 4096 UTF-8 bytes')

  assert.throws(
    () => writeVerticalBlockJson(oversized),
    RangeError,
    'The writer must enforce UTF-8 bytes rather than JavaScript string length',
  )

  assert.throws(
    () => writeVerticalBlockJson({ ...block, unexpected: true } as unknown as Block),
    RangeError,
    'Writing must reject unknown keys instead of silently stripping them',
  )
})

test('KAN-878 RED-8 rejects oversized v1 JSON on read without confusing UTF-8 bytes with string length', async () => {
  const { readVerticalBlockJson } = await import('../../lib/sessions/vertical-prescription-json')

  const block = {
    schemaVersion: 1,
    direction: 'ascent',
    repetitions: 2,
    coverage: 'partial',
    elevationGainPerRep: {
      meters: 200,
      provenance: { kind: 'track_adopted', trackReference: 'ñ'.repeat(2000) },
    },
    elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
  }
  const oversized = JSON.stringify(block)

  assert.ok(oversized.length < 4096, 'Fixture must remain under the JS code-unit count')
  assert.ok(Buffer.byteLength(oversized, 'utf8') > 4096, 'Fixture must exceed the UTF-8 byte limit')

  assert.deepEqual(
    readVerticalBlockJson(oversized),
    { status: 'corrupt' },
    'A persisted oversized v1 record must not be exposed as valid at read time',
  )

  const compact = JSON.stringify({
    ...block,
    elevationGainPerRep: {
      meters: 200,
      provenance: { kind: 'track_adopted', trackReference: 'short-track' },
    },
  })
  assert.deepEqual(
    readVerticalBlockJson(compact),
    { status: 'valid', block: JSON.parse(compact) },
    'Within-limit v1 records remain readable',
  )
})
