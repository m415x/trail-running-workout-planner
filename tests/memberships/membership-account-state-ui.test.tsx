import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { MembershipAccountState } from '@/features/memberships/components/MembershipAccountState'

test('Coach H4 account UI renders derived status, balances and explainable history without recalculating domain rules', () => {
  const html = renderToStaticMarkup(
    <MembershipAccountState
      locale='es'
      labels={{
        title: 'Estado de cuenta',
        totalBalance: 'Saldo total',
        period: 'Período',
        status: 'Estado',
        amountDue: 'Importe',
        paid: 'Pagado',
        remaining: 'Saldo',
        dueDate: 'Vencimiento',
        history: 'Historial económico',
        condition: 'Condición',
        globalException: 'Excepción global',
        reduction: 'Reducción / beca',
        extension: 'Prórroga',
        payments: 'Pagos',
        result: 'Resultado',
        settled: 'Al día',
        pending: 'Pendiente',
        overdue: 'Vencida',
        noHistory: 'Sin hechos adicionales',
      }}
      accountState={{
        cutoffDate: '2026-09-13',
        charges: [{
          id: 'charge-1',
          currency: 'ARS',
          amountDueMinor: 2_000_000,
          paidMinor: 750_000,
          remainingMinor: 1_250_000,
          effectiveDueDate: '2026-09-12',
          status: 'overdue',
        }],
        balanceByCurrency: [{
          currency: 'ARS',
          amountDueMinor: 2_000_000,
          paidMinor: 750_000,
          remainingMinor: 1_250_000,
        }],
      }}
      economicHistory={[{
        condition: {
          billingTermsId: 'terms-1',
          monthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          effectiveFrom: '2026-09-01',
          effectiveUntil: null,
        },
        charge: {
          monthlyChargeId: 'charge-1',
          year: 2026,
          month: 9,
          baseAmountMinor: 2_500_000,
          amountDueMinor: 2_000_000,
          currency: 'ARS',
          baseDueDate: '2026-09-08',
          effectiveDueDate: '2026-09-12',
        },
        globalDueDateHistory: [{
          id: 'global-1',
          teamId: 'team-1',
          year: 2026,
          month: 9,
          dueDate: '2026-09-08',
          reason: 'Feriado',
          isCurrent: true,
          state: 'current',
        }],
        reductionHistory: [{
          id: 'reduction-1',
          athleteId: 'athlete-1',
          year: 2026,
          month: 9,
          reductionAmountMinor: 500_000,
          reason: 'Beca',
          isCurrent: true,
          state: 'current',
        }],
        extensionHistory: [{
          id: 'extension-1',
          athleteId: 'athlete-1',
          year: 2026,
          month: 9,
          extendedDueDate: '2026-09-12',
          reason: 'Prórroga acordada',
          isCurrent: true,
          state: 'current',
        }],
        paymentHistory: [{
          revisionId: 'payment-rev-1',
          paymentId: 'payment-1',
          monthlyChargeId: 'charge-1',
          amountMinor: 750_000,
          paymentMethod: 'cash',
          paidAt: '2026-09-05',
          voided: false,
          isCurrent: true,
          state: 'current',
        }],
        result: {
          status: 'overdue',
          amountDueMinor: 2_000_000,
          paidMinor: 750_000,
          remainingMinor: 1_250_000,
          effectiveDueDate: '2026-09-12',
          currency: 'ARS',
        },
      }]}
    />,
  )

  assert.match(html, /Estado de cuenta/)
  assert.match(html, /Saldo total/)
  assert.match(html, /ARS/)
  assert.match(html, /Vencida/)
  assert.match(html, /Pagado/)
  assert.match(html, /Historial económico/)
  assert.match(html, /Excepción global/)
  assert.match(html, /Feriado/)
  assert.match(html, /Reducción \/ beca/)
  assert.match(html, /Beca/)
  assert.match(html, /Prórroga acordada/)
  assert.match(html, /Pagos/)
})
