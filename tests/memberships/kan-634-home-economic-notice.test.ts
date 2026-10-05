import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import test from 'node:test'

import { AthleteHomeEconomicNotice } from '../../features/memberships/components/AthleteHomeEconomicNotice'

test('KAN-634 exposes pending and overdue economic signals as readable ES/EN text, not color alone', () => {
  const warning = renderToStaticMarkup(createElement(AthleteHomeEconomicNotice, {
    locale: 'es',
    state: { tone: 'warning', message: 'current_pending' },
  }))
  assert.match(warning, /Cuota pendiente/)
  assert.match(warning, /href="\/profile"/)
  assert.doesNotMatch(warning, /href="\/es\/profile"/)
  assert.match(warning, /role="status"/)

  const danger = renderToStaticMarkup(createElement(AthleteHomeEconomicNotice, {
    locale: 'en',
    state: { tone: 'danger', message: 'current_overdue' },
  }))
  assert.match(danger, /Overdue membership payment/)
  assert.match(danger, /href="\/en\/profile"/)
  assert.match(danger, /role="alert"/)
})

test('KAN-634 explains prior-month debt without claiming routes or access are blocked before KAN-298', () => {
  const prior = renderToStaticMarkup(createElement(AthleteHomeEconomicNotice, {
    locale: 'es',
    state: { tone: 'danger', message: 'prior_overdue_debt' },
  }))
  assert.match(prior, /deuda vencida de un mes anterior/)
  assert.doesNotMatch(prior, /bloquead[oa]|sin acceso/i)
  assert.match(prior, /role="alert"/)
})

test('KAN-634 keeps unknown neutral and accessible without falsely claiming current charges are settled', () => {
  const html = renderToStaticMarkup(createElement(AthleteHomeEconomicNotice, {
    locale: 'en',
    state: { tone: 'neutral', message: 'account_unknown' },
  }))
  assert.match(html, /Membership information unavailable/)
  assert.doesNotMatch(html, /Up to date/)
  assert.match(html, /role="status"/)
})
