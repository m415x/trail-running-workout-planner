import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('components/maps/MapInner.tsx', 'utf8')

test('KAN-576 keeps localized start and finish popup text legible on MapLibre light popup surfaces in dark mode', () => {
  for (const key of ['startPoint', 'endPoint']) {
    const popup = source.match(new RegExp(`<div class="[^"]*text-slate-900[^"]*"[^>]*>\\s*<b>\\$\\{t\\('map\\.${key}'\\)\\}</b>\\s*<br/>\\s*<span class="[^"]*text-slate-600[^"]*">`))
    assert.ok(popup, `${key} popup must use explicit text colors independent of app theme`)
  }

  assert.match(source, /\.setLngLat\(startCoord\)/)
  assert.match(source, /\.setLngLat\(endCoord\)/)
})

test('KAN-576 starts with MapLibre attribution compact while preserving provider credits and toggle', () => {
  assert.match(source, /attributionControl:\s*false/)
  assert.match(source, /new maplibregl\.AttributionControl\(\{\s*compact:\s*true,?\s*\}\)/)
  assert.match(source, /map\.addControl\(\s*new maplibregl\.AttributionControl/)
  for (const provider of ['OpenStreetMap Contributors', 'OpenTopoMap', 'Esri, Maxar, Earthstar Geographics']) {
    assert.ok(source.includes(provider), `provider attribution must remain: ${provider}`)
  }

  assert.match(source, /map\.once\('style\.load', handleStyleLoad\)/)
  assert.match(source, /map\.setStyle\(nextStyle\)/)
  assert.match(source, /new ResizeObserver/)
})
