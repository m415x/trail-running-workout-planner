import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const map = readFileSync('components/maps/MapInner.tsx', 'utf8')
const styles = readFileSync('app/globals.css', 'utf8')

test('KAN-576 removes MapLibre native compact padding from the closed 29px attribution footprint', () => {
  // MapLibre v6 compact control has 24px right padding and content-box sizing.
  // Width alone is insufficient: the rendered control protrudes to the left.
  const compactRule = styles.match(/\.ept-map-attribution:not\(\.maplibregl-compact-show\)\s*\{([^}]*)\}/)?.[1]
  assert.ok(compactRule, 'closed-only scoped attribution rule exists')
  assert.match(compactRule, /(?:^|\s)width:\s*29px;/)
  assert.match(compactRule, /(?:^|\s)height:\s*29px;/)
  assert.match(compactRule, /(?:^|\s)padding:\s*0;/)
  assert.match(compactRule, /box-sizing:\s*border-box;/)

  const toggleRule = styles.match(/\.ept-map-attribution:not\(\.maplibregl-compact-show\)\s+\.maplibregl-ctrl-attrib-button\s*\{([^}]*)\}/)?.[1]
  assert.ok(toggleRule, 'closed-only positioning for the native 24px attribution summary exists')
  assert.match(toggleRule, /top:\s*2\.5px;/)
  assert.match(toggleRule, /right:\s*2\.5px;/)

  assert.doesNotMatch(map, /attribution\.style\.minWidth\s*=/)
  assert.doesNotMatch(map, /attributionToggle\.style\.(?:marginInline|float|display)\s*=/)
})

test('KAN-576 limits CSS geometry only to collapsed attribution and preserves native credits', () => {
  assert.doesNotMatch(styles, /\.ept-map-attribution\s*\{[^}]*\b(?:width|max-width|padding):/)
  assert.ok(map.indexOf('new maplibregl.AttributionControl({') < map.indexOf('new maplibregl.NavigationControl({'))
  assert.match(map, /classList\.remove\('maplibregl-compact-show'\)/)
  assert.match(map, /map\.once\('style\.load', handleStyleLoad\)/)
  for (const provider of ['OpenStreetMap Contributors', 'OpenTopoMap', 'Esri, Maxar, Earthstar Geographics']) {
    assert.ok(map.includes(provider))
  }
})
