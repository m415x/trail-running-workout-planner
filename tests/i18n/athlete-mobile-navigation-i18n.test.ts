import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 Athlete mobile navigation i18n boundary', () => {
  it('uses localized routing and catalog-backed labels', async () => {
    const source = await readFile('components/layout/BottomNavigationBar.tsx', 'utf8')

    assert.match(source, /from ['"]@\/i18n\/routing['"]/)
    assert.match(source, /useTranslations\(['"]AthleteShell['"]\)/)
    assert.doesNotMatch(source, /from ['"]next\/link['"]/)
    assert.doesNotMatch(source, /from ['"]next\/navigation['"]/)
    assert.doesNotMatch(source, /Inicio|Perfil/)
  })
})
