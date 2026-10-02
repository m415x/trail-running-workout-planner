import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('components/maps/MapInner.tsx', 'utf8')
const styles = readFileSync('app/globals.css', 'utf8')

test('KAN-576 places native attribution below zoom without forcing its size or centering', () => {
  const attribution = source.indexOf('new maplibregl.AttributionControl({')
  const navigation = source.indexOf('new maplibregl.NavigationControl({')
  assert.ok(attribution >= 0 && attribution < navigation, 'attribution registers before zoom in bottom-right')
  assert.match(source, /new maplibregl.AttributionControl\(\{\s*compact:\s*true,?\s*\}\),\s*'bottom-right'/)
  assert.match(source, /new maplibregl.NavigationControl\(\{\s*showCompass:\s*false,?\s*\}\),\s*'bottom-right'/)
  assert.doesNotMatch(styles, /\.ept-map-attribution/)
  assert.doesNotMatch(source, /attribution\.style\.minWidth\s*=/)
})

test('KAN-576 preserves initial native disclosure and map lifecycle', () => {
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
