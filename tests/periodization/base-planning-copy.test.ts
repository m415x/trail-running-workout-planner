import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createTranslator, NextIntlClientProvider } from 'next-intl'
import { PlanningIntentHelp } from '@/features/planning/components/PlanningIntentHelp'
import { localizeLoadIssue } from '@/features/planning/load-strategy-copy'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import es from '@/messages/es.json'
import en from '@/messages/en.json'

describe('base planning localized product copy', () => {
  for (const locale of ['es', 'en'] as const) {
    const messages = locale === 'es' ? es : en
    it(`renders reusable intent help in ${locale}`, () => {
      const providerProps = {
        locale, messages, timeZone: 'UTC', children: createElement(PlanningIntentHelp),
      }
      const html = renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps))
      assert.match(html, /<details/)
      assert.ok(html.includes(messages.DomainGlossary.planningIntent.maintenance))
      assert.doesNotMatch(html, /MISSING_MESSAGE|DomainGlossary\./)
    })
    it(`translates every load issue and interpolates reference values in ${locale}`, () => {
      // Runtime codes are checked against the real catalog; production translators
      // expose the same dynamic-key boundary through next-intl's provider.
      const t = createTranslator({ locale, messages, namespace: 'BasePlanning', onError: (error) => { throw error } }) as unknown as Parameters<typeof localizeLoadIssue>[2]
      const strategy = suggestLoadStrategy('S2', 'performance')
      const codes = Object.keys(messages.BasePlanning.issues).filter((code) => !code.startsWith('density-'))
      codes.push('initial-elevation-density-high', 'maximum-elevation-density-extreme')
      for (const code of codes) {
        const text = localizeLoadIssue({ code, field: 'initialWeeklyVolumeKm', severity: 'warning', message: 'legacy' }, strategy, t)
        assert.ok(text.length > 0)
        assert.doesNotMatch(text, /legacy|BasePlanning\./)
      }
    })
  }
  it('keeps both locale catalogs equivalent for the modified flow', () => {
    assert.deepEqual(Object.keys(es.BasePlanning).sort(), Object.keys(en.BasePlanning).sort())
    assert.deepEqual(Object.keys(es.BasePlanning.issues).sort(), Object.keys(en.BasePlanning.issues).sort())
  })
})
