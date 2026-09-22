import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const route = 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'

const athleteDetailSpanishCopy = /Volver al listado de atletas|Perfil del atleta|Datos personales|Fecha de nacimiento|Apodo|Sin grupo|Teléfono|No informado|Objetivos|Nuevo objetivo|Este atleta todavía no tiene objetivos registrados|Competencias|Registrar inscripción|Inscripciones próximas|Historial de participación|Planificación aplicable hoy|Contacto de emergencia/

describe('athlete detail i18n', () => {
  it('uses canonical next-intl translations for athlete detail copy', async () => {
    const source = await readFile(route, 'utf8')

    assert.match(source, /getTranslations/)
    assert.match(source, /namespace:\s*['"]AthleteDetail['"]/)
  })

  it('does not retain athlete-facing Spanish copy inline', async () => {
    const source = await readFile(route, 'utf8')

    assert.doesNotMatch(source, athleteDetailSpanishCopy)
  })
})
