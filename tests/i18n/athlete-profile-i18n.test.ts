import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 Athlete profile i18n closure', () => {
  it('moves profile tab labels behind AthleteProfile messages', async () => {
    const source = await readFile('features/profile/ProfileTab.tsx', 'utf8')

    assert.match(source, /useTranslations\(['"]AthleteProfile['"]\)/)
    assert.doesNotMatch(source, /Fisiología|Material|Ajustes/)
  })
})
