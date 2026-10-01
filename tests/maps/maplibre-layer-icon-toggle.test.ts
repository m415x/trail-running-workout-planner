import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const map = readFileSync('components/maps/MapInner.tsx', 'utf8')

test('KAN-576 renders an icon-only 29px basemap toggle consistent with native MapLibre controls', () => {
  const toggle = map.match(/<button\s+type='button'\s+aria-expanded=\{layerMenuOpen\}[\s\S]*?<\/button>/)?.[0]
  assert.ok(toggle, 'accessible basemap toggle must exist')
  assert.match(toggle, /aria-label=\{t\('map\.layers'\)\}/)
  assert.match(toggle, /title=\{t\('map\.layers'\)\}/)
  assert.match(toggle, /size-\[29px\]/)
  assert.match(toggle, /p-0/)
  assert.match(toggle, /<Layers3[^>]*aria-hidden='true'/)
  assert.doesNotMatch(toggle, />\s*\{t\('map\.layers'\)\}\s*<\/button>/)
  assert.match(toggle, /before:-inset-\[7\.5px\]/, 'visual 29px toggle retains a larger touch interaction region')

  assert.match(map, /aria-controls='basemap-layer-options'/)
  assert.match(map, /\{layerMenuOpen && \(/)
  assert.match(map, /aria-pressed=\{selectedLayer === key\}/)
  assert.match(map, /map\.once\('style\.load', handleStyleLoad\)/)
  assert.match(map, /map\.setStyle\(nextStyle\)/)
})
