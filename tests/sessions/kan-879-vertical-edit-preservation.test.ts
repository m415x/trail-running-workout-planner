import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const previous = {
  primaryObjective: 'elevation_gain' as const,
  verticalBlockJson: JSON.stringify({
    schemaVersion: 1,
    direction: 'ascent',
    repetitions: 2,
    coverage: 'complete',
    elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
    elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
  }),
}

test('KAN-879 RED-3 a legacy-only edit preserves existing vertical values; explicit clear is distinct', async () => {
  const modulePath = fileURLToPath(
    new URL('../../lib/sessions/session-vertical-edit-fields.ts', import.meta.url),
  )
  const imported = await import(pathToFileURL(modulePath).href).catch(() => ({}))
  const resolve = Reflect.get(imported, 'resolveVerticalPrescriptionEditFields') as
    | ((input: {
        previous: { primaryObjective: string | null; verticalBlockJson: string | null } | null
        primaryObjective?: string | null
        verticalBlock?: unknown
      }) => { primaryObjective: string | null; verticalBlockJson: string | null })
    | undefined
  assert.equal(typeof resolve, 'function', 'RED-3: vertical edit preservation resolver is missing')
  if (!resolve) return

  const legacyOnly = resolve({ previous })
  assert.deepEqual(legacyOnly, previous,
    'Legacy-only edit must not silently erase explicit objective, block or metric provenance')

  assert.deepEqual(resolve({ previous, primaryObjective: null, verticalBlock: null }), {
    primaryObjective: null,
    verticalBlockJson: null,
  }, 'Explicit clear must not be confused with omission')

  const explicit = resolve({
    previous,
    primaryObjective: 'duration',
    verticalBlock: { ...JSON.parse(previous.verticalBlockJson), coverage: 'partial' },
  })
  assert.equal(explicit.primaryObjective, 'duration')
  assert.equal(
    JSON.parse(explicit.verticalBlockJson ?? 'null').coverage,
    'partial',
    'An explicit new validated block must replace the previous one',
  )

  const unsupported = '{"schemaVersion":999,"data":"uninterpreted"}'
  assert.deepEqual(resolve({
    previous: { primaryObjective: null, verticalBlockJson: unsupported },
  }), { primaryObjective: null, verticalBlockJson: unsupported },
  'Omitted edit must preserve future schema bytes rather than normalize or erase them')
  assert.deepEqual(resolve({ previous: null }), {
    primaryObjective: null, verticalBlockJson: null,
  }, 'New Session + microcycle scope without vertical fields stays legacy null')
})
