import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('Coach sidebar exposes Membership through the localized CoachShell catalog', async () => {
  const [source, esCatalog, enCatalog] = await Promise.all([
    readFile('components/dashboard/app-sidebar.tsx', 'utf8'),
    readFile('messages/es/common/coach-shell.json', 'utf8'),
    readFile('messages/en/common/coach-shell.json', 'utf8'),
  ])

  assert.match(source, /href: ['"]\/dashboard\/membership['"]/)
  assert.match(source, /useTranslations\(['"]CoachShell['"]\)/)
  assert.match(source, /navigation\.\$\{item\.labelKey\}/)
  assert.doesNotMatch(source, /useLocale/)
  assert.doesNotMatch(source, /Membresía|Membership/)

  assert.equal(JSON.parse(esCatalog).CoachShell.navigation.membership, 'Membresía')
  assert.equal(JSON.parse(enCatalog).CoachShell.navigation.membership, 'Membership')
})

test('Coach sidebar uses the localized routing boundary instead of Next direct navigation', async () => {
  const source = await readFile('components/dashboard/app-sidebar.tsx', 'utf8')

  assert.match(source, /from ['"]@\/i18n\/routing['"]/)
  assert.match(source, /\bLink\b/)
  assert.match(source, /\busePathname\b/)
  assert.match(source, /\buseRouter\b/)
  assert.doesNotMatch(source, /from ['"]next\/link['"]/)
  assert.doesNotMatch(source, /from ['"]next\/navigation['"]/)
})
