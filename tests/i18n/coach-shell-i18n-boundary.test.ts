import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('Coach shell i18n boundary', () => {
  it('keeps Coach shell copy in the message catalog instead of hard-coded Spanish or locale ternaries', async () => {
    const [layout, sidebar, esCatalog, enCatalog] = await Promise.all([
      readFile('app/[locale]/dashboard/layout.tsx', 'utf8'),
      readFile('components/dashboard/app-sidebar.tsx', 'utf8'),
      readFile('messages/es/common/coach-shell.json', 'utf8'),
      readFile('messages/en/common/coach-shell.json', 'utf8'),
    ])

    for (const source of [layout, sidebar]) {
      assert.doesNotMatch(
        source,
        /Panel del Coach|Panel del coach|Gestión|Resumen|Atletas|Planificación|Sesiones|Membresía|Membership|Perfil|Configuración|Cerrar sesión/,
      )
    }

    assert.match(layout, /useTranslations\('CoachShell'\)/)
    assert.match(sidebar, /useTranslations\('CoachShell'\)/)

    const es = JSON.parse(esCatalog)
    const en = JSON.parse(enCatalog)

    assert.equal(es.CoachShell.title, 'Panel del Coach')
    assert.equal(en.CoachShell.title, 'Coach Dashboard')
    assert.equal(es.CoachShell.navigation.membership, 'Membresía')
    assert.equal(en.CoachShell.navigation.membership, 'Membership')
  })
})
