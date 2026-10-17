import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646/T5 internal SQLite writer derives today from an explicitly injected server regional timezone', () => {
  const source = readFileSync('lib/physiology/biometric-self-sqlite-server-writer.ts', 'utf8')
  assert.match(source, /resolveBiometricCivilToday/)
  assert.match(source, /timeZone/)
  assert.doesNotMatch(source, /toISOString\(\)\.slice\(0, 10\)/)
  assert.doesNotMatch(source, /process\.env\.TZ|Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/)
  assert.doesNotMatch(source, /input\.timeZone|input\.timezone/)
})

test('KAN-646/T5 no hard-coded regional timezone in the biometric writer', () => {
  const source = readFileSync('lib/physiology/biometric-self-sqlite-server-writer.ts', 'utf8')
  assert.doesNotMatch(source, /['"]America\/Argentina\/San_Juan['"]/)
  assert.doesNotMatch(source, /['"]UTC['"]/)
})
