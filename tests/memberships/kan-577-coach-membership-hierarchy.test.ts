import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const detail = readFileSync('app/[locale]/dashboard/athletes/[athleteId]/page.tsx', 'utf8')
const account = readFileSync('features/memberships/components/MembershipAccountState.tsx', 'utf8')
const actions = readFileSync('features/memberships/components/AthleteBillingTermsForm.tsx', 'utf8')
const translations = ['es', 'en'].map(locale =>
  JSON.parse(readFileSync(`messages/${locale}/athlete-detail.json`, 'utf8')),
)

test('KAN-577 coach membership has clear default summary and a single charge ledger', () => {
  assert.ok(detail.includes('membershipAccountTitle'))
  assert.ok(detail.includes('membershipTotalBalance'))
  assert.ok(detail.includes('<MembershipAccountState'))
  assert.ok(detail.includes('<AthleteBillingTermsForm'))
  assert.doesNotMatch(detail, /membership\.charges\.map\(\(charge\)/,
    'duplicated materialized charge list should not compete with account ledger')
  assert.ok(detail.includes('membershipManagementTitle'),
    'editable actions must have a separate translated section heading')
  for (const dictionary of translations) {
    assert.ok(dictionary.AthleteDetail?.membershipManagementTitle,
      'missing localized membership management heading')
  }
})

test('KAN-577 account history starts collapsed while status and past-debt alert stay visible', () => {
  assert.ok(account.includes("data-membership-blocked='true'"))
  assert.ok(account.includes('balanceByCurrency'))
  assert.ok(account.includes('accountState.charges.map'))
  assert.ok(account.includes('labels.history'))
  assert.doesNotMatch(account, /defaultValue=\{\[`history-\$\{charge\.id\}`\]\}/,
    'expanded audit details for each charge obscure statuses and balances')
})

test('KAN-577 membership actions remain available but grouped behind a dedicated disclosure', () => {
  assert.ok(detail.includes("AccordionItem value='membership-management'"))
  assert.ok(detail.includes('membershipManagementTitle'))
  assert.ok(actions.includes('MonthlyChargeReductionForm'))
  assert.ok(actions.includes('MonthlyChargeExtensionForm'))
  assert.ok(actions.includes('ManualPaymentSection'))
  assert.ok(actions.includes('applyInitialAthleteBillingTermsAction'))
  assert.ok(actions.includes('changeAthleteBillingTermsAction'))
  assert.ok(actions.includes('registerManualPaymentAction'))
  assert.ok(actions.includes('correctManualPaymentAction'))
  assert.ok(actions.includes('voidManualPaymentAction'))
})
