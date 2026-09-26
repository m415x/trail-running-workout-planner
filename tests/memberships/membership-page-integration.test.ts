import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('Coach membership page renders the policy snapshot and prospective form', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )

  assert.match(source, /MembershipPolicyCard model=\{model\.currentPolicy\}/)
  assert.match(source, /TeamEconomicPolicyForm/)
  assert.match(source, /model=\{model\.form\}/)
  assert.match(source, /locale=\{supportedLocale\}/)
})


test('Coach membership page exposes the next scheduled policy in ES and EN', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )

  assert.match(source, /model\.scheduledPolicies/)
  assert.match(source, /Cambios programados/)
  assert.match(source, /Scheduled changes/)
  assert.match(source, /model\.currentPolicy\.effectiveUntil/)
})


test('Coach membership page groups scheduled and past policies in localized accordions', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )

  assert.match(source, /model\.currentPolicy/)
  assert.match(source, /model\.scheduledPolicies/)
  assert.match(source, /model\.pastPolicies/)
  assert.match(source, /Cambios programados/)
  assert.match(source, /Scheduled changes/)
  assert.match(source, /Historial de políticas/)
  assert.match(source, /Policy history/)
  assert.match(source, /Accordion/)
  assert.doesNotMatch(source, /MembershipPolicyCard model=\{model\.nextPolicy\}/)
})


test('membership timeline accordions expose visible triggers with item counts', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )

  assert.match(source, /AccordionTrigger className=/)
  assert.match(source, /Cambios programados/)
  assert.match(source, /Scheduled changes/)
  assert.match(source, /Historial de políticas/)
  assert.match(source, /Policy history/)
  assert.match(source, /model\.scheduledPolicies\.length/)
  assert.match(source, /model\.pastPolicies\.length/)
})


test('membership timeline accordions render as one card surface when expanded', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )

  assert.match(source, /AccordionItem[^>]*className=/)
  assert.match(source, /border-border/)
  assert.match(source, /scheduledPolicies\.map/)
  assert.match(source, /pastPolicies\.map/)
  assert.doesNotMatch(
    source,
    /scheduledPolicies\.map\([\s\S]*?<MembershipPolicyCard/,
  )
  assert.doesNotMatch(
    source,
    /pastPolicies\.map\([\s\S]*?<MembershipPolicyCard/,
  )
})


test('Coach membership page exposes a localized global monthly due-date exception surface', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )
  const actions = await readFile(
    'app/actions/membership-actions.ts',
    'utf8',
  )
  const form = await readFile(
    'features/memberships/components/GlobalDueDateExceptionForm.tsx',
    'utf8',
  )

  assert.match(source, /GlobalDueDateExceptionForm/)
  assert.match(form, /Excepción mensual de vencimiento/)
  assert.match(form, /Monthly due-date exception/)
  assert.match(source, /locale=\{supportedLocale\}/)
  assert.match(actions, /applyGlobalDueDateExceptionAction/)
  assert.match(actions, /handlers\.applyGlobalDueDateException/)
})


test('Coach athlete billing surface exposes localized reduction and extension controls', async () => {
  const form = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )
  const actions = await readFile(
    'app/actions/membership-actions.ts',
    'utf8',
  )

  assert.match(form, /MonthlyChargeReductionForm/)
  assert.match(form, /MonthlyChargeExtensionForm/)
  assert.match(form, /Reducción o beca/)
  assert.match(form, /Reduction or scholarship/)
  assert.match(form, /Prórroga individual/)
  assert.match(form, /Individual extension/)
  assert.match(actions, /applyMonthlyChargeReductionAction/)
  assert.match(actions, /handlers\.applyMonthlyChargeReduction/)
  assert.match(actions, /applyMonthlyChargeExtensionAction/)
  assert.match(actions, /handlers\.applyMonthlyChargeExtension/)
})


test('KAN-479 Coach exception forms select persisted charges and expose H2 traceability instead of requesting internal IDs', async () => {
  const athleteForm = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )
  const membershipPage = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )

  assert.doesNotMatch(athleteForm, /placeholder=\{es \? 'ID del cargo'/)
  assert.match(athleteForm, /monthlyCharges/)
  assert.match(athleteForm, /reductionHistory/)
  assert.match(athleteForm, /extensionHistory/)
  assert.match(membershipPage, /globalDueDateExceptionHistory/)
})
