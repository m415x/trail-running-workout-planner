import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const card = readFileSync('features/workouts/components/RouteMapCard.tsx', 'utf8')
const es = JSON.parse(readFileSync('messages/es/realized-training/workouts.json', 'utf8')).Workouts
const en = JSON.parse(readFileSync('messages/en/realized-training/workouts.json', 'utf8')).Workouts

test('KAN-576 localizes RouteMapCard presentation without changing the MapLibre renderer', () => {
  assert.match(card, /useTranslations\(['"]Workouts['"]\)/)
  for (const key of ['loading', 'meetingPoint', 'distance', 'elevationGain', 'maxGrade']) {
    assert.ok(card.includes(`t('map.${key}')`), `RouteMapCard must localize ${key}`)
    assert.equal(typeof es.map?.[key], 'string', `ES missing map.${key}`)
    assert.equal(typeof en.map?.[key], 'string', `EN missing map.${key}`)
  }

  assert.doesNotMatch(card, /Cargando mapa GPS|Punto de encuentro|label='Distancia'|label='Desnivel'|Pendiente Máx\./)
  assert.match(card, /dynamic\(\(\) => import\(['"]@\/components\/maps\/MapInner['"]\)/)
  assert.match(card, /ssr:\s*false/)
  assert.match(card, /Number\.isFinite\(point\.lat\) && Number\.isFinite\(point\.lon\)/)
})
