import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const RESIDUALS = [
  {
    path: 'features/planning/components/GenerationExplanationView.tsx',
    markers: ['Decisión', 'Días y roles', 'Estímulo y plantilla'],
  },
  {
    path: 'features/planning/components/SessionGenerationPreferencesForm.tsx',
    markers: ['Miércoles'],
  },
  {
    path: 'features/planning/components/CompetitionCalendarSummary.tsx',
    markers: ['Fecha'],
  },
  {
    path: 'features/planning/components/IntensityDistribution.tsx',
    markers: ['Recuperación', 'Aeróbico'],
  },
  {
    path: 'features/planning/components/LoadProgressionPreview.tsx',
    markers: ['Guardar progresión'],
  },
] as const

describe('KAN-506 residual Coach planning copy', () => {
  it('moves the remaining inventoried Planning labels behind i18n', async () => {
    for (const entry of RESIDUALS) {
      const source = await readFile(entry.path, 'utf8')

      assert.match(source, /useTranslations|getTranslations/)
      for (const marker of entry.markers) {
        assert.equal(
          source.includes(marker),
          false,
          `${entry.path} should not retain: ${marker}`,
        )
      }
    }
  })
})
