import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveBiometricCivilToday } from '@/lib/physiology/biometric-regional-civil-date'

test('KAN-646/T5 uses the server-selected IANA regional civil day, not UTC', () => {
  const instant = new Date('2026-10-18T01:30:00.000Z')
  assert.equal(resolveBiometricCivilToday(instant, 'America/Argentina/San_Juan'), '2026-10-17')
  assert.equal(resolveBiometricCivilToday(instant, 'UTC'), '2026-10-18')
})

test('KAN-646/T5 regional civil day remains correct around timezone offsets and year boundary', () => {
  assert.equal(resolveBiometricCivilToday(new Date('2027-01-01T01:00:00.000Z'), 'America/Argentina/San_Juan'), '2026-12-31')
  assert.equal(resolveBiometricCivilToday(new Date('2026-10-17T02:00:00.000Z'), 'Asia/Tokyo'), '2026-10-17')
})

test('KAN-646/T5 fail-closed for invalid dates and timezones', () => {
  assert.throws(() => resolveBiometricCivilToday(new Date(Number.NaN), 'UTC'))
  assert.throws(() => resolveBiometricCivilToday(new Date(), 'Not/A_Real_Timezone'))
})
