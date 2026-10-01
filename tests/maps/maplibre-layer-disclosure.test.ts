import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const map = readFileSync('components/maps/MapInner.tsx', 'utf8')
const languages = ['es', 'en'].map(locale =>
  JSON.parse(readFileSync(`messages/${locale}/realized-training/workouts.json`, 'utf8')).Workouts.map,
)

test('KAN-576 shows a compact, accessible basemap disclosure instead of a permanent style list', () => {
  assert.match(map, /const \[layerMenuOpen, setLayerMenuOpen\] = useState\(false\)/)
  assert.match(map, /aria-expanded=\{layerMenuOpen\}/)
  assert.match(map, /aria-controls=['"]basemap-layer-options['"]/)
  assert.match(map, /t\('map\.layers'\)/)
  assert.match(map, /min-h-\[var\(--size-ept-touch-target\)\]/)
  assert.match(map, /\{layerMenuOpen && \(/)
  assert.match(map, /id='basemap-layer-options'/)
  assert.match(map, /onClick=\{\(\) => \{\s*setSelectedLayer\(key\)\s*setLayerMenuOpen\(false\)/)
  assert.match(map, /aria-pressed=\{selectedLayer === key\}/)

  for (const messages of languages) {
    assert.equal(typeof messages.layers, 'string')
    assert.equal(typeof messages.standard, 'string')
    assert.equal(typeof messages.topographic, 'string')
    assert.equal(typeof messages.satellite, 'string')
  }
})

test('KAN-576 does not change map-style lifecycle to implement the disclosure', () => {
  assert.match(map, /map\.once\('style\.load', handleStyleLoad\)/)
  assert.match(map, /map\.setStyle\(nextStyle\)/)
  assert.match(map, /map\.fitBounds\(bounds,/)
  assert.match(map, /new ResizeObserver/)
  assert.match(map, /selectedLayer, setSelectedLayer/)
})
