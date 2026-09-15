import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createTranslator, NextIntlClientProvider } from 'next-intl'
import { PlanningIntentHelp } from '@/features/planning/components/PlanningIntentHelp'
import { localizeLoadIssue } from '@/features/planning/load-strategy-copy'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

import esBasePlanning from '@/messages/es/planning/base-planning.json'
import enBasePlanning from '@/messages/en/planning/base-planning.json'
import esGlossary from '@/messages/es/glossary/planning.json'
import enGlossary from '@/messages/en/glossary/planning.json'

const catalogs = {
  es: {
    ...esBasePlanning,
    ...esGlossary,
  },
  en: {
    ...enBasePlanning,
    ...enGlossary,
  },
} as const

describe('base planning localized product copy', () => {
  for (const locale of ['es', 'en'] as const) {
    const messages = catalogs[locale]

    it(`renders reusable intent help in ${locale}`, () => {
      const providerProps = {
        locale,
        messages,
        timeZone: 'UTC',
        children: createElement(PlanningIntentHelp),
      }

      const html = renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps))

      assert.match(html, /<details/)
      assert.ok(html.includes(messages.DomainGlossary.planningIntent.maintenance))
      assert.doesNotMatch(html, /MISSING_MESSAGE|DomainGlossary\./)
    })

    it(`translates every load issue and interpolates reference values in ${locale}`, () => {
      const t = createTranslator({
        locale,
        messages,
        namespace: 'BasePlanning',
        onError: (error) => {
          throw error
        },
      }) as unknown as Parameters<typeof localizeLoadIssue>[2]

      const strategy = suggestLoadStrategy('S2', 'performance')

      const codes = Object.keys(messages.BasePlanning.issues).filter((code) => !code.startsWith('density-'))

      codes.push('initial-elevation-density-high', 'maximum-elevation-density-extreme')

      for (const code of codes) {
        const text = localizeLoadIssue(
          {
            code,
            field: 'initialWeeklyVolumeKm',
            severity: 'warning',
            message: 'legacy',
          },
          strategy,
          t,
        )

        assert.ok(text.length > 0)
        assert.doesNotMatch(text, /legacy|BasePlanning\./)
      }
    })
  }

  it('keeps both locale catalogs equivalent for the modified flow', () => {
    assert.deepEqual(Object.keys(catalogs.es.BasePlanning).sort(), Object.keys(catalogs.en.BasePlanning).sort())

    assert.deepEqual(
      Object.keys(catalogs.es.BasePlanning.issues).sort(),
      Object.keys(catalogs.en.BasePlanning.issues).sort(),
    )

    assert.deepEqual(
      Object.keys(catalogs.es.DomainGlossary.planningIntent).sort(),
      Object.keys(catalogs.en.DomainGlossary.planningIntent).sort(),
    )
  })
})
