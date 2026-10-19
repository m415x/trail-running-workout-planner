import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const volume = readFileSync('features/planning/components/MicrocycleVolumeForm.tsx', 'utf8')
const elevation = readFileSync('features/planning/components/MicrocycleElevationForm.tsx', 'utf8')

for (const [name, source] of [['volume', volume], ['elevation', elevation]] as const) {
  test(`KAN-815/A2 ${name} normalizes FormData before the existing authorized action`, () => {
    assert.match(source, /normalizeMicrocyclePlanningDraft/)
    assert.match(source, /FormData/)
    assert.match(source, /formAction\(/)
    assert.match(source, /type='text'/)
    assert.match(source, /inputMode=/)
  })
}

test('KAN-815/A2 volume rejects empty or incomplete draft before authorized action', () => {
  assert.match(volume, /normalizeMicrocyclePlanningDraft\([^,]+,\s*['"]volumeKm['"]\)/)
  assert.match(volume, /if\s*\(normalized\.status\s*!==\s*['"]valid['"]\)/)
  assert.match(volume, /targetVolumeKm/)
  assert.match(volume, /required/)
})

test('KAN-815/A2 elevation preserves intentional absence and rejects invalid fraction', () => {
  assert.match(elevation, /normalizeMicrocyclePlanningDraft\([^,]+,\s*['"]elevationGainM['"]\)/)
  assert.match(elevation, /normalized\.status\s*===\s*['"]invalid['"]/)
  assert.match(elevation, /formData\.set\(['"]targetElevationGain['"],\s*normalized\.status\s*===\s*['"]valid['"]\s*\?\s*normalized\.value\s*:\s*['"]['"]\)/)
  assert.match(elevation, /targetElevationGain/)
})

test('KAN-815/A2 keeps form identity fields and existing server actions', () => {
  for (const source of [volume, elevation]) {
    for (const field of ['microcycleId', 'planId', 'locale']) {
      assert.match(source, new RegExp(`name='${field}'`))
    }
  }
  assert.match(volume, /updateMicrocycleVolume/)
  assert.match(elevation, /updateMicrocycleElevation/)
})
