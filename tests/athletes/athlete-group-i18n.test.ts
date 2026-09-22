import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const surfaces = [
  'app/[locale]/dashboard/athletes/[athleteId]/group/page.tsx',
  'features/athletes/components/AthleteGroupForm.tsx',
] as const

const athleteGroupSpanishCopy = /Volver al detalle del atleta|Cambiar grupo|Asignar a grupo|Definí el grupo operativo actual|Grupo actual|Sin grupo|Nuevo grupo|Seleccioná un grupo|No hay otro grupo activo disponible|Fecha efectiva|Motivo|promoción de|Opcional\. Quedará registrado|Cancelar|Asignando…|Asignar grupo/

describe('athlete group i18n', () => {
  it('uses canonical next-intl translations across the group surfaces', async () => {
    for (const surface of surfaces) {
      const source = await readFile(surface, 'utf8')
      assert.match(source, /getTranslations|useTranslations/)
      assert.match(source, /AthleteGroup/)
    }
  })

  it('does not retain athlete-facing Spanish copy inline', async () => {
    for (const surface of surfaces) {
      const source = await readFile(surface, 'utf8')
      assert.doesNotMatch(source, athleteGroupSpanishCopy)
    }
  })
})
