import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const PRESENTATION_SURFACES = [
  'app/[locale]/(mobile)/plan/page.tsx',
  'features/athletes/components/RealizedTrainingHistory.tsx',
  'features/memberships/components/AthleteBillingTermsForm.tsx',
  'features/planning/components/SessionGenerationPreview.tsx',
  'features/planning/components/CompetitionCalendarSummary.tsx',
  'app/[locale]/dashboard/planning/[planId]/page.tsx',
] as const

describe('KAN-506 regional presentation boundary', () => {
  it('keeps language-to-presentation-locale mapping inside the application regional boundary', async () => {
    for (const path of PRESENTATION_SURFACES) {
      const source = await readFile(path, 'utf8')

      assert.doesNotMatch(
        source,
        /(?:locale|language)\s*===\s*['"](?:es|en)['"]\s*\?\s*['"](?:es-AR|en-US)['"]\s*:\s*['"](?:en-US|es-AR)['"]/,
        `${path} must consume presentationLocale instead of deriving it`,
      )
    }
  })

  it('keeps currency outside the application regional context', async () => {
    const source = await readFile(
      'lib/regionalization/application-regional-context.ts',
      'utf8',
    )

    assert.doesNotMatch(source, /currency/i)
  })
})
