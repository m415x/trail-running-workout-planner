import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const load = read('features/planning/components/LoadProgressionPreview.tsx')
const intensity = read('features/planning/components/IntensityDistribution.tsx')
const translations = ['es','en'].map(locale => JSON.parse(
  read('messages/' + locale + '/planning/coach-planning.json'),
).CoachPlanning)

test('KAN-577 load preview localizes chart legend, metrics, sources, help and hover details', () => {
  for (const key of ['description','volume','elevation','manualVolume','manualElevation',
    'week','initial','maximum','peakElevation','weeks','manual','generated',
    'resolveConflicts','saveHelp']) {
    assert.ok(load.includes("loadPreview." + key), 'missing load UI: ' + key)
    for (const m of translations) assert.ok(m.loadPreview?.[key], 'missing ES/EN load key: ' + key)
  }
  assert.doesNotMatch(load, /point\.volumeKm\.toLocaleString\('es-AR'\)/)
  assert.doesNotMatch(load, /point\.elevationGain\.toLocaleString\('es-AR'\)/)
  assert.ok(load.includes('locale'))
})

test('KAN-577 intensity distribution localizes headings, counts, zone and recovery', () => {
  for (const key of ['description','method','referencePercentage','heartRateZones',
    'maxIntense','manualStrategy','empty','week','manual','predominant',
    'noIntense','intenseSessions','recoveryDays']) {
    assert.ok(intensity.includes("intensityDistribution." + key), 'missing intensity UI: ' + key)
    for (const m of translations) assert.ok(m.intensityDistribution?.[key], 'missing ES/EN intensity key: ' + key)
  }
  assert.doesNotMatch(intensity, /Guardá la progresión para generar/)
  assert.doesNotMatch(intensity, /Sin sesiones intensas/)
})

test('KAN-577 planning previews localize microcycle types without changing domain identifiers', () => {
  for (const source of [load, intensity]) assert.ok(source.includes('microcycleType.types.'))
  for (const m of translations) for (const type of ['base','development','shock','deload','tapering','race']) {
    assert.ok(m.microcycleType?.types?.[type], 'missing microcycle type: ' + type)
  }
  assert.match(load, /point\.volumeSource === 'manual'/)
  assert.match(intensity, /hasManualValue\(point\.fieldSources\)/)
})
