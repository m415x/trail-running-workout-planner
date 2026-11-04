import assert from 'node:assert/strict'
import test from 'node:test'
import { formatCoachHomeDate } from '@/lib/coach-home/format-coach-home-date'

test('KAN-869/T6 formats civil dates using ES and EN presentation locales', () => {
  const es = formatCoachHomeDate('2026-11-04', 'es')
  const en = formatCoachHomeDate('2026-11-04', 'en')
  assert.notEqual(es, '2026-11-04')
  assert.notEqual(en, '2026-11-04')
  assert.match(es, /2026/)
  assert.match(en, /2026/)
  assert.match(es, /4/)
  assert.match(en, /4/)
  assert.notEqual(es, en, 'Regional presentation must differ between ES-AR and EN-US')
})

test('KAN-869/T6 preserves the civil day at a timezone boundary and leaves invalid dates unchanged', () => {
  for (const date of ['2026-01-01', '2026-12-31', '2024-02-29']) {
    for (const language of ['es', 'en'] as const) {
      const actual = formatCoachHomeDate(date, language)
      const day = Number(date.slice(-2))
      assert.match(actual, new RegExp(`\\b${day}\\b`))
    }
  }
  assert.equal(formatCoachHomeDate('2026-02-30', 'es'), '2026-02-30')
  assert.equal(formatCoachHomeDate('not-a-date', 'en'), 'not-a-date')
})
