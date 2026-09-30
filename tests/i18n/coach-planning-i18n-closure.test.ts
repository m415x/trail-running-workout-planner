import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const PLANNING_SURFACES = [
  'app/[locale]/dashboard/planning/[planId]/page.tsx',
  'features/planning/components/GenerationExplanationView.tsx',
  'features/planning/components/SessionGenerationPreview.tsx',
  'features/planning/components/MicrocycleDatesForm.tsx',
  'features/planning/components/MicrocycleElevationForm.tsx',
  'features/planning/components/MicrocycleNotesForm.tsx',
  'features/planning/components/MicrocycleTypeForm.tsx',
  'features/planning/components/MicrocycleVolumeForm.tsx',
  'features/planning/components/SessionGenerationPreferencesForm.tsx',
  'features/planning/components/CompetitionCalendarSummary.tsx',
  'features/planning/components/IntensityDistribution.tsx',
  'features/planning/components/LoadProgressionPreview.tsx',
] as const

describe('KAN-506 Coach planning i18n closure', () => {
  it('moves inventoried Planning/generation copy behind next-intl boundaries', async () => {
    for (const path of PLANNING_SURFACES) {
      const source = await readFile(path, 'utf8')

      assert.match(
        source,
        /useTranslations|getTranslations/,
        `${path} should consume an i18n boundary`,
      )
      assert.doesNotMatch(
        source,
        /Volver a planificaciones|Subgrupo de planificación|Por qué se generó así|Guardar sesiones|Guardar configuración semanal|Guardar fechas|Guardar notas|Guardar tipo|Volumen objetivo en kilómetros|Sin restricción|Política pendiente|Foco montaña/,
        `${path} should not retain inventoried Spanish presentation copy`,
      )
    }
  })

  it('does not hard-code es-AR inside the generation preview', async () => {
    const source = await readFile(
      'features/planning/components/SessionGenerationPreview.tsx',
      'utf8',
    )

    assert.doesNotMatch(source, /['"]es-AR['"]/)
  })
})
