import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 Athlete plan i18n and regional presentation', () => {
  it('uses AthletePlan messages and presentation locale instead of hard-coded es-AR', async () => {
    const source = await readFile('app/[locale]/(mobile)/plan/page.tsx', 'utf8')

    assert.match(source, /getTranslations/)
    assert.match(source, /resolveApplicationRegionalContext/)
    assert.doesNotMatch(source, /['"]es-AR['"]/)
    assert.doesNotMatch(
      source,
      /No se pudo cargar la planificación|Mi planificación|Semana actual|Competencias|Ver inscripciones|Hoy|Sin entrenamiento programado/,
    )
  })
})
