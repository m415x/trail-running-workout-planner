import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const map = readFileSync('components/maps/MapInner.tsx', 'utf8')
const styles = readFileSync('app/globals.css', 'utf8')

test('KAN-576 leaves the attribution dimensions and padding to MapLibre', () => {
  assert.doesNotMatch(styles, /\.ept-map-attribution/)
  assert.doesNotMatch(map, /attribution\.classList\.add\('ept-map-attribution'\)/)
  assert.doesNotMatch(map, /attribution\.style\.minWidth\s*=/)
  assert.doesNotMatch(map, /attributionToggle\.style\.(?:marginInline|float|display)\s*=/)
  assert.ok(map.indexOf('new maplibregl.AttributionControl({') < map.indexOf('new maplibregl.NavigationControl({'))
})

test('KAN-576 preserves the native initial-collapse behavior and source credits', () => {
  assert.match(map, /classList\.remove\('maplibregl-compact-show'\)/)
  assert.match(map, /map\.on\('load', handleLoad\)/)
  assert.match(map, /map\.off\('load', handleLoad\)/)
  assert.match(map, /map\.once\('style\.load', handleStyleLoad\)/)
  for (const provider of ['OpenStreetMap Contributors', 'OpenTopoMap', 'Esri, Maxar, Earthstar Geographics']) {
    assert.ok(map.includes(provider))
  }
})
