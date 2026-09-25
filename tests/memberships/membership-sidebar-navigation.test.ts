import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('Coach sidebar exposes the membership surface with ES/EN copy', async () => {
  const source = await readFile('components/dashboard/app-sidebar.tsx', 'utf8')

  assert.match(source, /href: ['"]\/dashboard\/membership['"]/)
  assert.match(source, /useLocale/)
  assert.match(source, /Membresía/)
  assert.match(source, /Membership/)
})

test('membership navigation does not require a global sidebar i18n refactor', async () => {
  const source = await readFile('components/dashboard/app-sidebar.tsx', 'utf8')

  assert.match(source, /label: ['"]Resumen['"]/)
  assert.match(source, /label: ['"]Atletas['"]/)
  assert.match(source, /label: ['"]Grupos['"]/)
})
