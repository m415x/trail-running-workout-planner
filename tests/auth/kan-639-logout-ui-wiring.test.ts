import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/[locale]/dashboard/DashboardShell.tsx', 'utf8')

test('KAN-639 coach shell wires the visible sign-out control to logoutAction', () => {
  assert.match(source, /logoutAction/)
  assert.match(source, /useLocale/)
  assert.match(source, /logoutAction\(/)
  assert.match(source, /signOut/)
})

test('KAN-639 coach shell passes only a supported locale to logoutAction', () => {
  assert.match(source, /locale\s*===\s*['"]en['"]/)
  assert.match(source, /['"]en['"]\s*:\s*['"]es['"]/)
})

test('KAN-639 keeps the existing localized sign-out label', () => {
  assert.match(source, /t\(['"]signOut['"]\)/)
})

test('KAN-642 Coach sign-out uses the Base UI Menu.Item click contract', () => {
  assert.match(source, /onClick=\{\(\)\s*=>\s*void\s+logoutAction\(logoutLocale\)\}/)
  assert.doesNotMatch(source, /onSelect=/)
})
