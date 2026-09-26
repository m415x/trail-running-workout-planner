import assert from 'node:assert/strict'
import test from 'node:test'

import { renderToStaticMarkup } from 'react-dom/server'

import { MembershipPolicyCard } from '../../features/memberships/components/MembershipPolicyCard'

test('renders the current H1 team economic policy', () => {
  const html = renderToStaticMarkup(
    <MembershipPolicyCard
      model={{
        title: 'Membresía',
        policyTitle: 'Política económica del equipo',
        monthlyAmountLabel: 'Cuota mensual predeterminada',
        monthlyAmount: '$25.000',
        currencyLabel: 'Moneda',
        currency: 'ARS',
        dueDayLabel: 'Día de vencimiento ordinario',
        dueDay: '5',
        effectiveFromLabel: 'Vigente desde',
        effectiveFrom: '2026-10-01',
        emptyState: 'Todavía no hay una política económica configurada.',
      }}
    />,
  )

  assert.match(html, /Política económica del equipo/)
  assert.match(html, /Cuota mensual predeterminada/)
  assert.match(html, /\$25\.000/)
  assert.match(html, /ARS/)
  assert.match(html, />5</)
  assert.match(html, /2026-10-01/)
})

test('renders the empty H1 policy state without H2+ concepts', () => {
  const html = renderToStaticMarkup(
    <MembershipPolicyCard
      model={{
        title: 'Membership',
        policyTitle: 'Team economic policy',
        monthlyAmountLabel: 'Default monthly fee',
        monthlyAmount: null,
        currencyLabel: 'Currency',
        currency: null,
        dueDayLabel: 'Ordinary due day',
        dueDay: null,
        effectiveFromLabel: 'Effective from',
        effectiveFrom: null,
        emptyState: 'No economic policy has been configured yet.',
      }}
    />,
  )

  assert.match(html, /No economic policy has been configured yet\./)
  assert.doesNotMatch(html, /payment|debt|pending|overdue|settled|scholarship/i)
})
