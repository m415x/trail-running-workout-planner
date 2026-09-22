import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const surfaces = [
  'app/[locale]/dashboard/athletes/page.tsx',
  'features/athletes/components/AthletesTable.tsx',
  'features/athletes/components/AthletesEmptyState.tsx',
] as const

const athleteListSpanishCopy = /Atletas|Perfiles del equipo|Nuevo atleta|Atleta|Contacto|Grupo \/ cohorte|Estado|Sin grupo|Conflicto de cohortes|Activo|Inactivo|Todavía no hay atletas|Cuando se agreguen perfiles activos/

describe('athlete list i18n', () => {
  it('uses canonical next-intl translations across the list surfaces', async () => {
    for (const surface of surfaces) {
      const source = await readFile(surface, 'utf8')
      assert.match(source, /getTranslations|useTranslations/)
    }
  })

  it('does not retain athlete-facing Spanish copy inline', async () => {
    for (const surface of surfaces) {
      const source = await readFile(surface, 'utf8')
      assert.doesNotMatch(source, athleteListSpanishCopy)
    }
  })
})
