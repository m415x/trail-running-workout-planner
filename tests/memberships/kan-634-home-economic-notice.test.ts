import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement, type ComponentProps } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { renderToStaticMarkup } from 'react-dom/server'
import test from 'node:test'

import { AthleteHomeEconomicNotice } from '../../features/memberships/components/AthleteHomeEconomicNotice'
import type { AthleteEconomicVisualState } from '../../lib/memberships/athlete-home-economic-visual'

const renderNotice = (locale: 'es' | 'en', state: AthleteEconomicVisualState) =>
  renderToStaticMarkup(createElement(
    NextIntlClientProvider,
    { locale, messages: {} } as ComponentProps<typeof NextIntlClientProvider>,
    createElement(AthleteHomeEconomicNotice, { locale, state }),
  ))

test('KAN-634 exposes pending and overdue economic signals as readable ES/EN text, not color alone', () => {
  const warning = renderNotice('es', { tone: 'warning', message: 'current_pending' })
  assert.match(warning, /Cuota pendiente/)
  assert.match(warning, /href="\/profile"/)
  assert.doesNotMatch(warning, /href="\/es\/profile"/)
  assert.match(warning, /role="status"/)

  const danger = renderNotice('en', { tone: 'danger', message: 'current_overdue' })
  assert.match(danger, /Overdue membership payment/)
  assert.match(danger, /href="\/en\/profile"/)
  assert.match(danger, /role="alert"/)
})

test('KAN-634 explains prior-month debt without claiming routes or access are blocked before KAN-298', () => {
  const prior = renderNotice('es', { tone: 'danger', message: 'prior_overdue_debt' })
  assert.match(prior, /deuda vencida de un mes anterior/)
  assert.doesNotMatch(prior, /bloquead[oa]|sin acceso/i)
  assert.match(prior, /role="alert"/)
})

test('KAN-634 keeps unknown neutral and accessible without falsely claiming current charges are settled', () => {
  const html = renderNotice('en', { tone: 'neutral', message: 'account_unknown' })
  assert.match(html, /Membership information unavailable/)
  assert.doesNotMatch(html, /Up to date/)
  assert.match(html, /role="status"/)
})

test('KAN-634 warning and danger use materially stronger light/dark semantic surfaces after browser acceptance feedback', () => {
  const warning = renderNotice('es', { tone: 'warning', message: 'current_pending' })
  assert.match(warning, /bg-amber-200/)
  assert.match(warning, /dark:bg-amber-900\/70/)

  const danger = renderNotice('es', { tone: 'danger', message: 'current_overdue' })
  assert.match(danger, /bg-red-200/)
  assert.match(danger, /dark:bg-red-900\/70/)

  const shellSource = readFileSync('lib/memberships/athlete-home-economic-shell.ts', 'utf8')
  assert.match(shellSource, /warning: 'bg-amber-100 dark:bg-amber-900\/50'/)
  assert.match(shellSource, /danger: 'bg-red-100 dark:bg-red-900\/50'/)
})

test('KAN-634 due-day picker uses the shared bounded themed Select instead of a native popup', () => {
  const source = readFileSync('features/memberships/components/GlobalDueDateExceptionForm.tsx', 'utf8')
  assert.doesNotMatch(source, /<select/)
  assert.match(source, /SelectTrigger/)
  assert.match(source, /SelectContent/)
  assert.match(source, /SelectItem/)
  assert.match(source, /className='w-full'/)
  assert.match(source, /dark:bg-slate-950/)
  assert.match(source, /dark:text-slate-50/)
})
