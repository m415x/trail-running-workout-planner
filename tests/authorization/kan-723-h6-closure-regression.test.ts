import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { evaluateH6PriorDebt } from '@/lib/memberships/h6-prior-debt-self-guard'
import { projectH6TeamDebtSnapshot } from '@/lib/memberships/h6-debt-reversal-isolation'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-723 all ten public economic writes route through server-authorized boundaries', () => {
  const source = read('app/actions/membership-actions.ts')
  const actions = [
    ['configureTeamEconomicPolicyAction', 'configureAuthorizedPolicy'],
    ['applyInitialAthleteBillingTermsAction', 'authorizedTermsAndMaterialization.applyInitial'],
    ['changeAthleteBillingTermsAction', 'authorizedTermsAndMaterialization.change'],
    ['materializeTeamMonthlyChargesAction', 'authorizedTermsAndMaterialization.materialize'],
    ['applyGlobalDueDateExceptionAction', 'authorizedEconomicExceptions.global'],
    ['applyMonthlyChargeReductionAction', 'authorizedEconomicExceptions.reduction'],
    ['applyMonthlyChargeExtensionAction', 'authorizedEconomicExceptions.extension'],
    ['registerManualPaymentAction', 'authorizedPayments.register'],
    ['correctManualPaymentAction', 'authorizedPayments.correct'],
    ['voidManualPaymentAction', 'authorizedPayments.voidPayment'],
  ] as const
  for (const [action, delegate] of actions) {
    const start = source.indexOf('export async function ' + action + '(')
    assert.ok(start >= 0, action + ' must remain an exported server action')
    const next = source.indexOf('export async function ', start + 1)
    const block = source.slice(start, next === -1 ? undefined : next)
    assert.ok(block.includes(delegate + '('), action + ' must use ' + delegate)
    assert.ok(!block.includes('handlers.'), action + ' must not bypass H6')
  }
})

test('KAN-723 exactly two Athlete SELF write entrypoints wire persisted H6 evidence', () => {
  const source = read('app/actions/realized-training-actions.ts')
  for (const action of ['createManualRealizedTrainingAction', 'correctManualRealizedTrainingAction']) {
    const start = source.indexOf('export async function ' + action + '(')
    assert.ok(start >= 0, action)
    const end = source.indexOf('export async function ', start + 1)
    const block = source.slice(start, end === -1 ? undefined : end)
    assert.ok(block.includes('evaluateEconomicAccess: evaluateH6SelfDebtFromPersistence'), action)
  }
  assert.equal((source.match(/evaluateEconomicAccess: evaluateH6SelfDebtFromPersistence/g) ?? []).length, 2)
})

test('KAN-723 reconciled prior debt decision is non-persisted and reverses after payment correction', async () => {
  const charge = { id: 'charge_a', teamId: 'team_a', athleteProfileId: 'athlete_a', year: 2026, month: 9, amountDueMinor: 300, effectiveDueDate: '2026-09-05' }
  const decide = async (amountMinor: number, voided = false) => {
    const charges = projectH6TeamDebtSnapshot({
      teamId: 'team_a',
      athleteProfileId: 'athlete_a',
      charges: [charge],
      revisions: [{ paymentId: 'payment_a', monthlyChargeId: charge.id, amountMinor, voided, isCurrent: true }],
    })
    return evaluateH6PriorDebt({
      teamId: 'team_a',
      athleteProfileId: 'athlete_a',
      cutoffDate: '2026-10-09',
      loadCharges: async () => charges,
    })
  }
  assert.deepEqual(await decide(300), { status: 'allowed' })
  assert.deepEqual(await decide(100), { status: 'blocked' })
  assert.deepEqual(await decide(300, true), { status: 'blocked' })
})
