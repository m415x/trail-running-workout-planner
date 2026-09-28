import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { MembershipAccountState } from '@/features/memberships/components/MembershipAccountState'

const labels = {
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
  priorDebtBlocked: 'Bloqueado por deuda vencida de un mes anterior',
}

function accountState(status: 'settled' | 'pending' | 'overdue') {
  return {
    cutoffDate: '2026-09-27',
    charges: [{
      id: 'charge-august',
      currency: 'ARS',
      amountDueMinor: 2_500_000,
      paidMinor: status === 'settled' ? 2_500_000 : 0,
      remainingMinor: status === 'settled' ? 0 : 2_500_000,
      effectiveDueDate: status === 'pending' ? '2026-09-30' : '2026-08-20',
      status,
    }],
    balanceByCurrency: [{
      currency: 'ARS',
      amountDueMinor: 2_500_000,
      paidMinor: status === 'settled' ? 2_500_000 : 0,
      remainingMinor: status === 'settled' ? 0 : 2_500_000,
    }],
  }
}

const economicHistory = [{
  condition: {
    billingTermsId: 'terms-1',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-08-01',
    effectiveUntil: null,
  },
  charge: {
    monthlyChargeId: 'charge-august',
    year: 2026,
    month: 8,
    baseAmountMinor: 2_500_000,
    amountDueMinor: 2_500_000,
    currency: 'ARS',
    baseDueDate: '2026-08-05',
    effectiveDueDate: '2026-08-20',
  },
  globalDueDateHistory: [],
  reductionHistory: [],
  extensionHistory: [],
  paymentHistory: [],
  result: {
    status: 'overdue' as const,
    amountDueMinor: 2_500_000,
    paidMinor: 0,
    remainingMinor: 2_500_000,
    effectiveDueDate: '2026-08-20',
    currency: 'ARS',
  },
}]

test('Coach H5 account UI shows prior-debt blocking from the shared derived experience', () => {
  const html = renderToStaticMarkup(
    <MembershipAccountState
      locale='es'
      labels={labels}
      accountState={accountState('overdue')}
      economicHistory={economicHistory}
      debtExperience={{
        asOfDate: '2026-09-27',
        blockedForPriorDebt: true,
        blockingChargeIds: ['charge-august'],
        charges: [{
          ...accountState('overdue').charges[0],
          year: 2026,
          month: 8,
        }],
      }}
    />,
  )

  assert.match(html, /Bloqueado por deuda vencida de un mes anterior/)
  assert.match(html, /data-membership-blocked="true"/)
})

test('Coach H5 account UI does not infer blocking from a prior-month charge that H4 still marks pending', () => {
  const pendingAccount = accountState('pending')
  const html = renderToStaticMarkup(
    <MembershipAccountState
      locale='es'
      labels={labels}
      accountState={pendingAccount}
      economicHistory={[{
        ...economicHistory[0],
        result: {
          ...economicHistory[0].result,
          status: 'pending',
          effectiveDueDate: '2026-09-30',
        },
      }]}
      debtExperience={{
        asOfDate: '2026-09-27',
        blockedForPriorDebt: false,
        blockingChargeIds: [],
        charges: [{
          ...pendingAccount.charges[0],
          year: 2026,
          month: 8,
        }],
      }}
    />,
  )

  assert.doesNotMatch(html, /Bloqueado por deuda vencida de un mes anterior/)
  assert.doesNotMatch(html, /data-membership-blocked="true"/)
})

test('Coach H5 account UI clears the block when the shared projection is recomputed after settlement', () => {
  const settledAccount = accountState('settled')
  const html = renderToStaticMarkup(
    <MembershipAccountState
      locale='es'
      labels={labels}
      accountState={settledAccount}
      economicHistory={[]}
      debtExperience={{
        asOfDate: '2026-09-27',
        blockedForPriorDebt: false,
        blockingChargeIds: [],
        charges: [{
          ...settledAccount.charges[0],
          year: 2026,
          month: 8,
        }],
      }}
    />,
  )

  assert.doesNotMatch(html, /data-membership-blocked="true"/)
})
