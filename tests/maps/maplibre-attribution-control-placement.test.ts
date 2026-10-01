import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('components/maps/MapInner.tsx', 'utf8')

test('KAN-576 places compact attribution beneath zoom, centered to the zoom control', () => {
  // MapLibre prepends controls in its bottom-right corner. Adding attribution
  // before navigation makes navigation render above the attribution.
  const attribution = source.indexOf('new maplibregl.AttributionControl({')
  const navigation = source.indexOf('new maplibregl.NavigationControl({')
  assert.ok(attribution >= 0 && navigation >= 0)
  assert.ok(attribution < navigation, 'register attribution before navigation in bottom-right')
  assert.match(source, /new maplibregl.AttributionControl\(\{\s*compact:\s*true,?\s*\}\),\s*'bottom-right'/)
  assert.match(source, /new maplibregl.NavigationControl\(\{\s*showCompass:\s*false,?\s*\}\),\s*'bottom-right'/)

  // Align the compact control through scoped CSS, not inline overrides.
  assert.match(source, /attribution\.classList\.add\('ept-map-attribution'\)/)
  assert.doesNotMatch(source, /attribution\.style\.minWidth\s*=/)
  assert.doesNotMatch(source, /attributionToggle\.style\.(?:marginInline|float|display)\s*=/)
})

test('KAN-576 keeps attribution initially hidden, native toggle usable and map lifecycle intact', () => {
  assert.match(source, /const collapseInitialAttribution = \(\) => \{/)
  assert.match(source, /classList\.remove\('maplibregl-compact-show'\)/)
  assert.match(source, /map\.on\('load', handleLoad\)/)
  assert.match(source, /map\.off\('load', handleLoad\)/)
  for (const provider of ['OpenStreetMap Contributors', 'OpenTopoMap', 'Esri, Maxar, Earthstar Geographics']) {
    assert.ok(source.includes(provider))
  }
  assert.match(source, /map\.once\('style\.load', handleStyleLoad\)/)
  assert.match(source, /map\.setStyle\(nextStyle\)/)
  assert.match(source, /new ResizeObserver/)
})
