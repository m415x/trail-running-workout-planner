import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 each economic exception revision retains author identity or explicit unknown', () => {
  const source = readFileSync('lib/memberships/billing.ts', 'utf8')
  for (const name of ['GlobalDueDateExceptionRevision', 'MonthlyChargeReductionRevision', 'MonthlyChargeExtensionRevision']) {
    const start = source.indexOf('export type ' + name + ' = {')
    assert.ok(start >= 0, name)
    const declaration = source.slice(start, source.indexOf('}', start))
    assert.ok(declaration.includes('createdByUserId: string | null'), name + ' requires nullable durable author')
  }
})

test('KAN-730 all three exception actions derive revision author from verified H7A context', () => {
  const source = readFileSync('lib/memberships/billing-coach-actions.ts', 'utf8')
  for (const name of ['applyGlobalDueDateExceptionAction', 'applyMonthlyChargeReductionAction', 'applyMonthlyChargeExtensionAction']) {
    const start = source.indexOf('export async function ' + name + '(')
    assert.ok(start >= 0, name)
    const next = source.indexOf('export async function ', start + 1)
    const action = source.slice(start, next < 0 ? undefined : next)
    assert.ok(action.includes('authorship?: TrustedH7aAuthorship'), name + ' accepts server-verified authorship')
    assert.ok(action.includes('createdByUserId: input.authorship?.effectiveActorUserId ?? null'), name + ' writes verified actor, not a client identity')
  }
})
