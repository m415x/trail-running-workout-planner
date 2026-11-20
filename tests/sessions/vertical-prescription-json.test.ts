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
