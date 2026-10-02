import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('components/maps/MapInner.tsx', 'utf8')

test('KAN-576 initially minimizes the actual MapLibre attribution disclosure after map load', () => {
  assert.match(source, /attributionControl:\s*false/)
  assert.match(source, /new maplibregl\.AttributionControl\(\{\s*compact:\s*true,?\s*\}\)/)

  // MapLibre's compact option does NOT mean initially collapsed: its internal
  // maplibregl-compact-show class reveals provider text until first drag.
  assert.match(source, /const collapseInitialAttribution = \(\) => \{/)
  assert.match(source, /querySelector(?:<HTMLElement>)?\(['"]\.maplibregl-ctrl-attrib['"]\)/)
  assert.match(source, /classList\.remove\(['"]maplibregl-compact-show['"]\)/)
  assert.match(source, /removeAttribute\(['"]open['"]\)/)
  assert.match(source, /const handleLoad = \(\) => \{[\s\S]*?collapseInitialAttribution\(\)[\s\S]*?setMapReady\(true\)[\s\S]*?\}/)

  // The user's manual expansion must not be reset on each style update.
  const collapseCalls = source.match(/collapseInitialAttribution\(\)/g) ?? []
  assert.equal(collapseCalls.length, 1, 'collapse only on initial load, never on every style change')
  assert.match(source, /map\.on\('load', handleLoad\)/)
  assert.match(source, /map\.off\('load', handleLoad\)/)
  assert.match(source, /map\.once\('style\.load', handleStyleLoad\)/)
})

test('KAN-576 does not remove obligatory basemap provider credits', () => {
  for (const provider of ['OpenStreetMap Contributors', 'OpenTopoMap', 'Esri, Maxar, Earthstar Geographics']) {
    assert.ok(source.includes(provider), `missing attribution: ${provider}`)
  }
  assert.match(source, /map\.addControl\(\s*new maplibregl\.AttributionControl/)
})
