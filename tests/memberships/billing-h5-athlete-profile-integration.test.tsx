import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ProfileTab } from '@/features/profile/ProfileTab'

const debtExperience = {
  asOfDate: '2026-09-27',
  blockedForPriorDebt: true,
  blockingChargeIds: ['charge-august'],
  charges: [{
    id: 'charge-august',
    year: 2026,
    month: 8,
    currency: 'ARS',
    amountDueMinor: 2_500_000,
    paidMinor: 0,
    remainingMinor: 2_500_000,
    effectiveDueDate: '2026-08-20',
    status: 'overdue' as const,
  }],
}

test('Athlete profile renders the H5 membership experience next to the existing profile content', () => {
  const html = renderToStaticMarkup(
    <ProfileTab
      membershipStatus={
        <div data-testid='membership-status'>
          Estado de membresía · deuda vencida de un mes anterior
        </div>
      }
    />,
  )

  assert.match(html, /data-testid="membership-status"/)
  assert.match(html, /Estado de membresía/)
  assert.match(html, /Fisiología/)
})

test('mobile profile route loads current athlete membership through the existing H4/H5 read model and passes only the derived experience to ProfileTab', () => {
  const source = readFileSync(
    'app/[locale]/(mobile)/profile/page.tsx',
    'utf8',
  )

  assert.match(source, /getCurrentAthlete/)
  assert.match(source, /createAthleteMembershipPageLoader/)
  assert.match(source, /createSqliteBillingPersistencePort/)
  assert.match(source, /getCurrentISODateInTimeZone/)
  assert.match(source, /athleteProfile\.teamId/)
  assert.match(source, /athleteProfile\.id/)
  assert.match(source, /debtExperience=\{membership\.debtExperience\}/)
  assert.doesNotMatch(source, /materializeMonthlyCharges/)
  assert.doesNotMatch(source, /blockedForPriorDebt\s*:/)
})

test('profile integration does not require a monetary aggregate contract', () => {
  assert.equal('totalRemainingMinor' in debtExperience, false)
})
