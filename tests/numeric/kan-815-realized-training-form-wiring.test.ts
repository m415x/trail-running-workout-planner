import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const hook = readFileSync('features/workouts/hooks/useLogWorkoutDialog.ts', 'utf8')
const dialog = readFileSync('features/workouts/components/LogWorkoutDialog.tsx', 'utf8')

test('KAN-815/A2 capture hook uses strict regional adapter for all numeric metrics', () => {
  assert.match(hook, /import\s*\{\s*parseRealizedTrainingMetricDraft\s*\}\s*from\s*['"]@\/lib\/numeric\/realized-training-metric-draft['"]/)
  assert.match(hook, /parseRealizedTrainingMetricDraft\(distance,\s*['"]distanceKm['"]\)/)
  assert.match(hook, /parseRealizedTrainingMetricDraft\(gain,\s*['"]elevationGainM['"]\)/)
  assert.match(hook, /parseRealizedTrainingMetricDraft\(avgHr,\s*['"]avgHrBpm['"]\)/)
  assert.doesNotMatch(hook, /function metricFromInput\(/)
})

test('KAN-815/A2 rejects malformed metric drafts before creating payload and calling onSave', () => {
  assert.match(hook, /if\s*\(\s*distanceResult\.status\s*===\s*['"]invalid['"]\s*\|\|/)
  assert.match(hook, /setSaveError\(['"]invalidMetric['"]\)/)
  assert.match(hook, /distanceKm:\s*distanceResult\.metric/)
  assert.match(hook, /elevationGainM:\s*gainResult\.metric/)
  assert.match(hook, /avgHrBpm:\s*avgHrResult\.metric/)
})

test('KAN-815/A2 retains original safety guards and error presentation', () => {
  assert.match(hook, /captureLocalInstant\(performedLocal\)/)
  assert.match(hook, /if\s*\(!dateStr\s*\|\|\s*!onSave\s*\|\|\s*saving\.current\)\s*return/)
  assert.match(dialog, /saveError/)
  assert.match(dialog, /invalidMetric/)
})

test('KAN-815/A2 text input accepts local comma decimal and integer mobile keyboards', () => {
  assert.match(dialog, /id='distance'[\s\S]{0,130}type='text'[\s\S]{0,130}inputMode='decimal'/)
  assert.match(dialog, /id='elevationGain'[\s\S]{0,130}type='text'[\s\S]{0,130}inputMode='numeric'/)
  assert.match(dialog, /id='averageHeartRate'[\s\S]{0,130}type='text'[\s\S]{0,130}inputMode='numeric'/)
})
