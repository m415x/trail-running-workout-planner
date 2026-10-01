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


test('KAN-561 isolates MapLibre load and style.load lifecycle without refitting on style changes', () => {
  assert.match(mapSource, /map\.on\(['"]load['"],\s*handleLoad\)/)
  assert.match(mapSource, /map\.off\(['"]load['"],\s*handleLoad\)/)
  assert.match(mapSource, /map\.once\(['"]style\.load['"],\s*handleStyleLoad\)/)
  assert.match(mapSource, /const handleStyleLoad = \(\) => \{[\s\S]*?renderTrack\(map,\s*false\)[\s\S]*?\}/)
  assert.match(mapSource, /map\.once\(['"]style\.load['"],\s*handleStyleLoad\)[\s\S]*?map\.setStyle\(nextStyle\)/)

  assert.doesNotMatch(mapSource, /map\.on\(['"]move/)
  assert.doesNotMatch(mapSource, /map\.on\(['"]zoom/)
})

test('KAN-561 resizes MapLibre when its container changes size and cleans up the observer', () => {
  assert.match(mapSource, /new ResizeObserver/)
  assert.match(mapSource, /map\.resize\(\)/)
  assert.match(mapSource, /resizeObserver\.observe\(mapContainerRef\.current\)/)
  assert.match(mapSource, /resizeObserver\.disconnect\(\)/)
})


test('KAN-561 renders after loaded or idle style without deferring to the next basemap change', () => {
  assert.match(
    mapSource,
    /if\s*\(!map\.isStyleLoaded\(\)\)\s*\{\s*map\.once\(['"]idle['"],\s*renderLoadedStyle\)\s*return\s*\}\s*renderLoadedStyle\(\)/,
  )

  assert.match(
    mapSource,
    /ensureTrackLayer\(map\)[\s\S]*renderMarkers\(map\)/,
  )

  assert.match(
    mapSource,
    /const renderLoadedStyle = \(\) => \{[\s\S]*?ensureTrackLayer\(map\)[\s\S]*?renderMarkers\(map\)[\s\S]*?if \(fit\) \{[\s\S]*?fitTrack\(map\)/,
  )
  assert.match(mapSource, /map\.once\(['"]idle['"],\s*renderLoadedStyle\)/)

  assert.doesNotMatch(
    mapSource,
    /\/\/\s*if\s*\(!map\.isStyleLoaded\(\)\)/,
  )
})


test('KAN-561 rebuilds the benchmark GeoJSON source and line layer deterministically', () => {
  assert.match(
    mapSource,
    /if\s*\(map\.getLayer\(TRAIL_LAYER_ID\)\)\s*\{[\s\S]*map\.removeLayer\(TRAIL_LAYER_ID\)/,
  )
  assert.match(
    mapSource,
    /if\s*\(map\.getSource\(TRAIL_SOURCE_ID\)\)\s*\{[\s\S]*map\.removeSource\(TRAIL_SOURCE_ID\)/,
  )
  assert.match(
    mapSource,
    /map\.addSource\(TRAIL_SOURCE_ID,[\s\S]*type:\s*['"]geojson['"][\s\S]*data:\s*trackFeature[\s\S]*lineMetrics:\s*true/,
  )
  assert.match(
    mapSource,
    /map\.addLayer\(\{[\s\S]*id:\s*TRAIL_LAYER_ID[\s\S]*type:\s*['"]line['"][\s\S]*source:\s*TRAIL_SOURCE_ID/,
  )
  assert.doesNotMatch(mapSource, /existingSource/)
  assert.doesNotMatch(mapSource, /geojsonSource\.setData/)
})
