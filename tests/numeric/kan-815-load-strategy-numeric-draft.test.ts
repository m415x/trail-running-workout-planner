import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLoadStrategyNumericDraft } from '@/lib/numeric/load-strategy-numeric-draft'

test('KAN-815/A2 decimal strategy fields accept comma or point without rounding', () => {
  for (const raw of ['42,5', '42.5']) {
    assert.deepEqual(parseLoadStrategyNumericDraft(raw, 'initialWeeklyVolumeKm'), { status: 'valid', value: 42.5 })
  }
  assert.deepEqual(parseLoadStrategyNumericDraft('7,2', 'maximumWeeklyIncreasePercentage'), { status: 'valid', value: 7.2 })
})

test('KAN-815/A2 required strategy fields distinguish empty, editing and invalid', () => {
  assert.deepEqual(parseLoadStrategyNumericDraft('', 'initialWeeklyVolumeKm'), { status: 'empty' })
  assert.deepEqual(parseLoadStrategyNumericDraft('42,', 'initialWeeklyVolumeKm'), { status: 'editing' })
  for (const raw of ['42,55', '1.234,5', '42abc', '1e2']) {
    assert.deepEqual(parseLoadStrategyNumericDraft(raw, 'initialWeeklyVolumeKm'), { status: 'invalid' }, raw)
  }
})

test('KAN-815/A2 optional elevation preserves null instead of fabricated zero', () => {
  assert.deepEqual(parseLoadStrategyNumericDraft('', 'initialWeeklyElevationGain'), { status: 'empty' })
  assert.deepEqual(parseLoadStrategyNumericDraft('850', 'initialWeeklyElevationGain'), { status: 'valid', value: 850 })
  assert.deepEqual(parseLoadStrategyNumericDraft('850,5', 'initialWeeklyElevationGain'), { status: 'invalid' })
})

test('KAN-815/A2 syntax parser leaves domain limits to load-strategy validator', () => {
  assert.deepEqual(parseLoadStrategyNumericDraft('-2', 'initialWeeklyVolumeKm'), { status: 'valid', value: -2 })
  assert.deepEqual(parseLoadStrategyNumericDraft('100000', 'maximumWeeklyElevationGain'), { status: 'valid', value: 100000 })
})
