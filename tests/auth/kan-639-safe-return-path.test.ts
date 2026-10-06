import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveSafeAuthReturnPath } from '../../lib/auth/safe-return-path'

test('KAN-639 preserves an internal localized return path', () => {
  assert.equal(
    resolveSafeAuthReturnPath('/es/dashboard/sessions?view=week#today', 'es'),
    '/es/dashboard/sessions?view=week#today',
  )
  assert.equal(
    resolveSafeAuthReturnPath('/en/profile', 'en'),
    '/en/profile',
  )
})

test('KAN-639 falls back to the current locale home when return target is absent', () => {
  assert.equal(resolveSafeAuthReturnPath(null, 'es'), '/es')
  assert.equal(resolveSafeAuthReturnPath(undefined, 'en'), '/en')
  assert.equal(resolveSafeAuthReturnPath('', 'es'), '/es')
})

test('KAN-639 rejects absolute and protocol-relative return URLs', () => {
  for (const value of [
    'https://evil.example/es/dashboard',
    'http://evil.example/en/profile',
    '//evil.example/es/dashboard',
    'javascript:alert(1)',
    'data:text/html,pwned',
  ]) {
    assert.equal(resolveSafeAuthReturnPath(value, 'es'), '/es')
  }
})

test('KAN-639 rejects backslash and encoded redirect tricks', () => {
  for (const value of [
    '/\\evil.example/path',
    '/%5cevil.example/path',
    '/%2fevil.example/path',
    '/es/%5c%5cevil.example',
  ]) {
    assert.equal(resolveSafeAuthReturnPath(value, 'es'), '/es')
  }
})

test('KAN-639 rejects paths outside the supported locale namespace', () => {
  assert.equal(resolveSafeAuthReturnPath('/dashboard', 'es'), '/es')
  assert.equal(resolveSafeAuthReturnPath('/fr/dashboard', 'es'), '/es')
  assert.equal(resolveSafeAuthReturnPath('/en/dashboard', 'es'), '/es')
})

test('KAN-639 rejects malformed current locales fail closed', () => {
  assert.equal(resolveSafeAuthReturnPath('/es/dashboard', 'fr' as 'es'), '/es')
})
