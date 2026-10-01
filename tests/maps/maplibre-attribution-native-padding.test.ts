import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const map = readFileSync('components/maps/MapInner.tsx', 'utf8')
const styles = readFileSync('app/globals.css', 'utf8')

test('KAN-576 restores native compact attribution geometry without application-specific overrides', () => {
  assert.doesNotMatch(styles, /\.ept-map-attribution/)
  assert.doesNotMatch(map, /attribution\.classList\.add\('ept-map-attribution'\)/)
  assert.doesNotMatch(map, /attribution\.style\.(?:width|minWidth|maxWidth|height|padding)/)
  assert.doesNotMatch(map, /attributionToggle\.style\./)
  assert.match(map, /new maplibregl\.AttributionControl\(\{\s*compact:\s*true,?\s*\}\)/)
})

test('KAN-576 retains native provider disclosure and map contracts', () => {
  assert.match(map, /classList\.remove\('maplibregl-compact-show'\)/)
  assert.match(map, /map\.on\('load', handleLoad\)/)
  assert.match(map, /map\.off\('load', handleLoad\)/)
  assert.match(map, /map\.once\('style\.load', handleStyleLoad\)/)
  for (const provider of ['OpenStreetMap Contributors', 'OpenTopoMap', 'Esri, Maxar, Earthstar Geographics']) {
    assert.ok(map.includes(provider))
  }
})
