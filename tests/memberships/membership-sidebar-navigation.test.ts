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

test('membership navigation preserves unrelated legacy labels while planning audiences use scoped i18n', async () => {
  const source = await readFile('components/dashboard/app-sidebar.tsx', 'utf8')

  assert.match(source, /label: ['"]Resumen['"]/)
  assert.match(source, /label: ['"]Atletas['"]/)
  assert.match(source, /label: ['"]Planificación['"]/)
  assert.match(source, /label: ['"]sportingGroups['"]/)
  assert.match(source, /label: ['"]planningSubgroups['"]/)
  assert.match(source, /useTranslations\(['"]CoachPlanningAudience['"]\)/)
})
