import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 remaining Athlete walkthrough i18n', () => {
  it('regionalizes and localizes the week calendar picker', async () => {
    const picker = await readFile(
      'features/workouts/components/WeekCalendarPicker.tsx',
      'utf8',
    )
    const hook = await readFile(
      'features/workouts/hooks/useWeekCalendarPicker.ts',
      'utf8',
    )

    assert.match(picker, /useTranslations/)
    assert.match(picker, /resolveApplicationRegionalContext/)
    assert.doesNotMatch(picker, /DAYS_OF_WEEK|>Hoy<|Semana seleccionada/)
    assert.doesNotMatch(hook, /MONTHS_OF_YEAR/)
  })

  it('localizes Athlete Plan session-card chrome without translating persisted content', async () => {
    const source = await readFile(
      'features/athlete-planning/components/AthleteSessionCard.tsx',
      'utf8',
    )

    assert.match(source, /useTranslations\('AthletePlan'\)/)
    assert.doesNotMatch(
      source,
      /Tu volumen|Carga por definir|Lugar|Ubicación por confirmar|Intensidad:|Ejercicios preliminares|Entrada en calor|Bloque principal|Vuelta a la calma|Instrucciones|Para tu grupo|Indicaciones generales|Sin instrucciones adicionales/,
    )

    assert.match(source, /session\.title/)
    assert.match(source, /prescription\.notes/)
    assert.match(source, /session\.notes/)
  })
})
