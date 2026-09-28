import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { AthleteMembershipStatus } from '@/features/memberships/components/AthleteMembershipStatus'

const debtExperience = {
  asOfDate: '2026-09-27',
  blockedForPriorDebt: true,
  blockingChargeIds: ['august-overdue'],
  charges: [
    {
      id: 'august-overdue',
      year: 2026,
      month: 8,
      currency: 'ARS',
      amountDueMinor: 2_500_000,
      paidMinor: 0,
      remainingMinor: 2_500_000,
      effectiveDueDate: '2026-08-20',
      status: 'overdue' as const,
    },
    {
      id: 'september-pending',
      year: 2026,
      month: 9,
      currency: 'USD',
      amountDueMinor: 10_000,
      paidMinor: 0,
      remainingMinor: 10_000,
      effectiveDueDate: '2026-09-30',
      status: 'pending' as const,
    },
    {
      id: 'july-settled',
      year: 2026,
      month: 7,
      currency: 'ARS',
      amountDueMinor: 2_500_000,
      paidMinor: 2_500_000,
      remainingMinor: 0,
      effectiveDueDate: '2026-07-05',
      status: 'settled' as const,
    },
  ],
}

test('Athlete H5 ES renders overdue red, pending yellow, settled neutral and a specific prior-debt block explanation', () => {
  const html = renderToStaticMarkup(
    <AthleteMembershipStatus locale='es' debtExperience={debtExperience} />,
  )

  assert.match(html, /Estado de membresía/)
  assert.match(html, /Cuota vencida/)
  assert.match(html, /Pendiente/)
  assert.match(html, /Al día/)
  assert.match(html, /deuda vencida de un mes anterior/i)
  assert.match(html, /data-status="overdue"/)
  assert.match(html, /data-status="pending"/)
  assert.match(html, /data-status="settled"/)
  assert.match(html, /border-red-|bg-red-/)
  assert.match(html, /border-yellow-|bg-yellow-/)
  assert.match(html, /bg-background|border-border/)
  assert.match(html, /ARS/)
  assert.match(html, /USD/)
})

test('Athlete H5 EN localizes status and block explanation without combining currencies', () => {
  const html = renderToStaticMarkup(
    <AthleteMembershipStatus locale='en' debtExperience={debtExperience} />,
  )

  assert.match(html, /Membership status/)
  assert.match(html, /Overdue/)
  assert.match(html, /Pending/)
  assert.match(html, /Up to date/)
  assert.match(html, /overdue debt from a previous month/i)
  assert.match(html, /ARS/)
  assert.match(html, /USD/)
  assert.doesNotMatch(html, /Total balance|Saldo total/)
})

test('Athlete H5 does not show a blocking explanation when no prior charge is blocking', () => {
  const html = renderToStaticMarkup(
    <AthleteMembershipStatus
      locale='es'
      debtExperience={{
        asOfDate: '2026-09-27',
        blockedForPriorDebt: false,
        blockingChargeIds: [],
        charges: [{
          id: 'september-overdue',
          year: 2026,
          month: 9,
          currency: 'ARS',
          amountDueMinor: 2_500_000,
          paidMinor: 0,
          remainingMinor: 2_500_000,
          effectiveDueDate: '2026-09-05',
          status: 'overdue',
        }],
      }}
    />,
  )

  assert.match(html, /Cuota vencida/)
  assert.doesNotMatch(html, /deuda vencida de un mes anterior/i)
})
