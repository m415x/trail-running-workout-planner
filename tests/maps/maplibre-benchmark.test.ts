import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mapSource = readFileSync('components/maps/MapInner.tsx', 'utf8')

test('KAN-561 reduces the MapLibre benchmark to one monocolor LineString', () => {
  assert.match(mapSource, /Feature<LineString>/)
  assert.match(mapSource, /type:\s*['"]LineString['"]/)
  assert.match(
    mapSource,
    /coordinates:\s*validPoints\.map\(\(point\) => \[point\.lon, point\.lat\]\)/,
  )

  assert.match(mapSource, /['"]line-color['"]:\s*['"]#ff0000['"]/)
  assert.doesNotMatch(mapSource, /buildAltitudeSegments/)
  assert.doesNotMatch(mapSource, /altitudePercent/)
  assert.doesNotMatch(mapSource, /getMapLibreAltitudeColorExpression/)
})

test('KAN-561 keeps fitBounds based on the same longitude-latitude benchmark coordinates', () => {
  assert.match(
    mapSource,
    /const bounds = getTrackBounds\(coordinates\)/,
  )
  assert.match(mapSource, /map\.fitBounds\(bounds,/)
  assert.match(mapSource, /animate:\s*false/)
})
