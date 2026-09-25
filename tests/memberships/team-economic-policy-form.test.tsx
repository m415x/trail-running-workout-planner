import assert from 'node:assert/strict'
import test from 'node:test'

import { renderToStaticMarkup } from 'react-dom/server'

import { TeamEconomicPolicyForm } from '../../features/memberships/components/TeamEconomicPolicyForm'

test('renders the initial team economic policy form', () => {
  const html = renderToStaticMarkup(
    <TeamEconomicPolicyForm
      model={{
        mode: 'initial',
        title: 'Configurar política económica',
        submitLabel: 'Guardar política',
        monthlyAmountLabel: 'Cuota mensual predeterminada',
        currencyLabel: 'Moneda',
        dueDayLabel: 'Día de vencimiento ordinario',
        effectiveFromLabel: 'Vigente desde',
        effectiveFromHelp: 'La política debe comenzar el primer día de un mes.',
        monthlyAmountMinor: null,
        currency: 'ARS',
        ordinaryDueDay: 5,
      }}
    />,
  )

  assert.match(html, /Configurar política económica/)
  assert.match(html, /name="monthlyAmount"/)
  assert.match(html, /name="currency"/)
  assert.match(html, /value="ARS"/)
  assert.match(html, /name="ordinaryDueDay"/)
  assert.match(html, /value="5"/)
  assert.match(html, /name="effectiveFrom"/)
  assert.match(html, /Guardar política/)
})

test('renders a prospective replacement without H2+ controls', () => {
  const html = renderToStaticMarkup(
    <TeamEconomicPolicyForm
      model={{
        mode: 'replacement',
        title: 'Schedule economic policy change',
        submitLabel: 'Schedule change',
        monthlyAmountLabel: 'Default monthly fee',
        currencyLabel: 'Currency',
        dueDayLabel: 'Ordinary due day',
        effectiveFromLabel: 'Effective from',
        effectiveFromHelp: 'The new policy must start on the first day of a month.',
        monthlyAmountMinor: 2_500_000,
        currency: 'ARS',
        ordinaryDueDay: 5,
      }}
    />,
  )

  assert.match(html, /Schedule economic policy change/)
  assert.match(html, /value="25000"/)
  assert.match(html, /Schedule change/)
  assert.doesNotMatch(html, /payment|debt|scholarship|extension|overdue|settled/i)
})
