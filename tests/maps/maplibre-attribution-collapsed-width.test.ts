import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const map = readFileSync('components/maps/MapInner.tsx', 'utf8')
const styles = readFileSync('app/globals.css', 'utf8')

test('KAN-576 constrains ONLY collapsed attribution to 29px beneath zoom', () => {
  assert.match(map, /attribution\.classList\.add\('ept-map-attribution'\)/)
  assert.match(styles, /\.ept-map-attribution:not\(\.maplibregl-compact-show\)\s*\{[^}]*width:\s*29px;/)
  assert.match(styles, /\.ept-map-attribution:not\(\.maplibregl-compact-show\)\s*\{[^}]*max-width:\s*29px;/)
  assert.match(styles, /\.ept-map-attribution:not\(\.maplibregl-compact-show\)\s*\{[^}]*box-sizing:\s*border-box;/)

  // Expanded provider credits must not be clipped to the icon width.
  assert.doesNotMatch(styles, /\.ept-map-attribution\s*\{[^}]*max-width:\s*29px;/)
  assert.match(map, /attributionToggle\.style\.marginInline\s*=\s*'auto'/)
  assert.ok(map.indexOf('new maplibregl.AttributionControl({') < map.indexOf('new maplibregl.NavigationControl({'))
})

test('KAN-576 preserves initial collapse, native toggle and MapLibre contracts', () => {
  assert.match(map, /classList\.remove\('maplibregl-compact-show'\)/)
  assert.match(map, /map\.on\('load', handleLoad\)/)
  assert.match(map, /map\.off\('load', handleLoad\)/)
  assert.match(map, /map\.once\('style\.load', handleStyleLoad\)/)
  for (const provider of ['OpenStreetMap Contributors', 'OpenTopoMap', 'Esri, Maxar, Earthstar Geographics']) {
    assert.ok(map.includes(provider))
  }
})
