import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const elevation = readFileSync('features/workouts/components/ElevationProfileCard.tsx', 'utf8')
const map = readFileSync('components/maps/MapInner.tsx', 'utf8')
const locales = ['es', 'en'].map((locale) =>
  JSON.parse(readFileSync(`messages/${locale}/realized-training/workouts.json`, 'utf8')).Workouts.map,
)

test('KAN-576 localizes elevation headings and preserves regional altitude formatting', () => {
  assert.match(elevation, /useTranslations\(['"]Workouts['"]\)/)
  for (const key of ['elevationProfile', 'maximum', 'minimum']) {
    assert.ok(elevation.includes(`t('map.${key}')`), `elevation missing map.${key}`)
    for (const messages of locales) assert.equal(typeof messages?.[key], 'string')
  }

  assert.doesNotMatch(elevation, /Perfil de Elevación|>Máx | >Mín /)
  assert.match(elevation, /formatNumber\(elevMax, regionalContext\.presentationLocale\)/)
  assert.match(elevation, /formatNumber\(elevMin, regionalContext\.presentationLocale\)/)
})

test('KAN-576 localizes layer and marker copy without changing style identity or marker placement', () => {
  assert.match(map, /useTranslations\(['"]Workouts['"]\)/)
  for (const key of ['standard', 'topographic', 'satellite', 'startPoint', 'endPoint']) {
    assert.ok(map.includes(`t('map.${key}')`), `map missing map.${key}`)
    for (const messages of locales) assert.equal(typeof messages?.[key], 'string')
  }

  assert.doesNotMatch(map, /🗺️ Estándar|⛰️ Topográfico|🛰️ Satelital|Punto de Largada|Punto de Llegada/)
  assert.match(map, /selectedLayer, setSelectedLayer/)
  assert.match(map, /\.setLngLat\(startCoord\)/)
  assert.match(map, /\.setLngLat\(endCoord\)/)
})
