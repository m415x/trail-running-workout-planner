import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const designSystemDoc = readFileSync(
  'docs/architecture/platform/ui-design-system.md',
  'utf8',
)

test('KAN-561 records the deterministic MapLibre benchmark and decision gate durably', () => {
  for (const phrase of [
    'single monocolor LineString',
    '[lon, lat]',
    'fitBounds',
    'ResizeObserver',
    'map.resize()',
    'style.load',
    'MapLibre',
    'setWorkerUrl',
    'maplibre-gl-worker.mjs',
    'maplibre-gl-shared.mjs',
    '61cf855de565ce53932b8153e9865a8919730747',
  ]) {
    assert.ok(
      designSystemDoc.includes(phrase),
      `missing cartographic benchmark decision: ${phrase}`,
    )
  }
})

test('KAN-561 keeps altitude styling outside the minimum gate and corrects the stale Leaflet reference', () => {
  assert.match(
    designSystemDoc,
    /altitude gradient[\s\S]*(outside|not part of)[\s\S]*(minimum|gate)/i,
  )
  assert.match(
    designSystemDoc,
    /previously referenced as a historical Leaflet implementation[\s\S]*also contains MapLibre/i,
  )
  assert.match(
    designSystemDoc,
    /not Leaflet evidence/i,
  )
  assert.match(
    designSystemDoc,
    /same benchmark[\s\S]*(same|identical) criteria/i,
  )
})
