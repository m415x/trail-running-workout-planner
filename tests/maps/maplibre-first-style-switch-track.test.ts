import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('components/maps/MapInner.tsx', 'utf8')

test('KAN-576 rebuilds the track on the FIRST basemap change even if the style is not fully loaded at style.load', () => {
  // MapLibre may emit style.load before isStyleLoaded() becomes true while
  // raster sources are still loading. Waiting for another style.load leaves
  // the track missing until the second basemap selection.
  assert.match(source, /const handleStyleLoad = \(\) => \{[\s\S]*?renderTrack\(map,\s*false\)[\s\S]*?\}/)
  assert.match(source, /map\.once\('style\.load', handleStyleLoad\)/)
  assert.match(source, /map\.setStyle\(nextStyle\)/)

  // When renderTrack cannot safely render immediately, its deferred work must
  // be associated with an event that happens for THIS style, not the NEXT one.
  const deferred = source.match(/if\s*\(!map\.isStyleLoaded\(\)\)\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.ok(deferred, 'keep the unloaded-style safety guard')
  assert.match(deferred, /map\.once\('idle', renderLoadedStyle\)/)
  assert.doesNotMatch(deferred, /map\.once\('style\.load', renderLoadedStyle\)/)
})

test('KAN-576 does not refit on style change or disturb benchmark rendering contracts', () => {
  assert.match(source, /ensureTrackLayer\(map\)[\s\S]*?renderMarkers\(map\)/)
  assert.match(source, /const renderLoadedStyle = \(\) => \{[\s\S]*?ensureTrackLayer\(map\)[\s\S]*?renderMarkers\(map\)/)
  assert.match(source, /renderTrack\(map,\s*true\)/)
  assert.match(source, /renderTrack\(map,\s*false\)/)
  assert.match(source, /map\.on\('load', handleLoad\)/)
  assert.match(source, /map\.off\('load', handleLoad\)/)
  assert.match(source, /new ResizeObserver/)
  assert.match(source, /\.fitBounds\(bounds,/)
})
