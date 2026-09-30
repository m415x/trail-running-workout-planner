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
  assert.match(source, /t\('page\.scheduledChanges'/)
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
  assert.match(source, /t\('page\.scheduledChanges'/)
  assert.match(source, /t\('page\.policyHistory'/)
  assert.match(source, /Accordion/)
  assert.doesNotMatch(source, /MembershipPolicyCard model=\{model\.nextPolicy\}/)
})


test('membership timeline accordions expose visible triggers with item counts', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )

  assert.match(source, /AccordionTrigger className=/)
  assert.match(source, /t\('page\.scheduledChanges'/)
  assert.match(source, /t\('page\.policyHistory'/)
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
  assert.match(form, /useTranslations\('Membership\.dueDateException'\)/)
  assert.match(form, /t\('title'\)/)
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
  assert.match(form, /useTranslations\('Membership\.athleteBilling'\)/)
  assert.match(form, /t\('reduction\.title'\)/)
  assert.match(form, /t\('extension\.title'\)/)
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


test('KAN-479 H2 Coach surfaces load persisted charges and revision history instead of placeholder arrays', async () => {
  const membershipPage = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )
  const pageModel = await readFile(
    'lib/memberships/membership-page-model.ts',
    'utf8',
  )
  const athleteForm = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.doesNotMatch(membershipPage, /globalDueDateExceptionHistory:[\s\S]*= \[\]/)
  assert.match(pageModel, /globalDueDateExceptionHistory/)
  assert.match(pageModel, /listGlobalDueDateExceptionRevisions/)
  assert.match(athleteForm, /monthlyCharges/)
  assert.match(athleteForm, /reductionHistory/)
  assert.match(athleteForm, /extensionHistory/)
})


test('KAN-479 Coach UI exposes explicit reduction and extension withdrawal controls in ES/EN', async () => {
  const athleteForm = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )
  const actions = await readFile(
    'app/actions/membership-actions.ts',
    'utf8',
  )

  assert.match(athleteForm, /t\('reduction\.withdraw'\)/)
  assert.match(athleteForm, /t\('extension\.withdraw'\)/)
  assert.match(actions, /reductionAmountMinor:\s*number/)
  assert.match(actions, /extendedDueDate:\s*string \| null/)
})


test('KAN-479 athlete detail wires persisted charge identities and H2 revision history into Coach forms', async () => {
  const athletePage = await readFile(
    'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
    'utf8',
  )
  const athleteLoader = await readFile(
    'lib/memberships/athlete-membership-page-loader.ts',
    'utf8',
  )

  assert.match(athleteLoader, /monthlyCharges/)
  assert.match(athleteLoader, /reductionHistory/)
  assert.match(athleteLoader, /extensionHistory/)
  assert.match(athleteLoader, /listMonthlyChargeReductionRevisions/)
  assert.match(athleteLoader, /listMonthlyChargeExtensionRevisions/)
  assert.match(athletePage, /monthlyCharges=\{membership\.monthlyCharges\}/)
  assert.match(athletePage, /reductionHistory=\{membership\.reductionHistory\}/)
  assert.match(athletePage, /extensionHistory=\{membership\.extensionHistory\}/)
})


test('KAN-479 withdrawal controls do not require an active reduction amount or extension date', async () => {
  const athleteForm = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.match(athleteForm, /name='reductionAmount'[\s\S]*?required/)
  assert.match(athleteForm, /t\('reduction\.withdraw'\)/)
  assert.match(athleteForm, /formNoValidate/)
  assert.match(athleteForm, /name='extendedDueDate'[\s\S]*?required/)
  assert.match(athleteForm, /t\('extension\.withdraw'\)/)
})


test('KAN-479 H2 Coach forms expose localized success feedback in ES and EN', async () => {
  const globalForm = await readFile(
    'features/memberships/components/GlobalDueDateExceptionForm.tsx',
    'utf8',
  )
  const athleteForm = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.match(globalForm, /t\('success'\)/)
  assert.match(athleteForm, /t\('reduction\.appliedSuccess'\)/)
  assert.match(athleteForm, /t\('reduction\.withdrawnSuccess'\)/)
  assert.match(athleteForm, /t\('extension\.appliedSuccess'\)/)
  assert.match(athleteForm, /t\('extension\.withdrawnSuccess'\)/)
})


test('KAN-479 global exception selects one month and a due day within that same month', async () => {
  const form = await readFile(
    'features/memberships/components/GlobalDueDateExceptionForm.tsx',
    'utf8',
  )

  assert.match(form, /name='period'[^>]*type='month'/)
  assert.match(form, /t\('dueDay'\)/)
  assert.match(form, /name='dueDay'/)
  assert.doesNotMatch(form, /name='dueDate'[^>]*type='date'/)
  assert.match(form, /daysInMonth/)
  assert.match(form, /String\(month\)\.padStart\(2, '0'\)/)
  assert.match(form, /String\(dueDay\)\.padStart\(2, '0'\)/)
})


test('KAN-479 athlete membership is compact by default and only exposes charge exceptions for materialized charges', async () => {
  const athletePage = await readFile(
    'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
    'utf8',
  )
  const athleteForm = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.match(athletePage, /AccordionItem value='membership'/)
  assert.match(athletePage, /AccordionTrigger/)
  assert.match(athletePage, /membership\.currentTerms\?\.monthlyAmount/)
  assert.match(athletePage, /AccordionContent/)
  assert.match(athleteForm, /monthlyCharges\.length > 0/)
  assert.match(athleteForm, /<MonthlyChargeReductionForm/)
  assert.match(athleteForm, /<MonthlyChargeExtensionForm/)
})


test('KAN-479 Coach membership page exposes localized team monthly materialization', async () => {
  const page = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )
  const actions = await readFile(
    'app/actions/membership-actions.ts',
    'utf8',
  )

  const form = await readFile(
    'features/memberships/components/TeamMonthlyMaterializationForm.tsx',
    'utf8',
  )

  assert.match(page, /TeamMonthlyMaterializationForm/)
  assert.match(form, /useTranslations\('Membership\.materialization'\)/)
  assert.match(form, /t\('title'\)/)
  assert.match(form, /type=['"]month['"]/)
  assert.match(form, /materializeTeamMonthlyChargesAction/)
  assert.match(actions, /materializeTeamMonthlyChargesAction/)
  assert.match(actions, /handlers\.materializeTeamMonthlyCharges/)
})


test('KAN-479 bulk monthly materialization reports localized processed and created counts to Coach', async () => {
  const form = await readFile(
    'features/memberships/components/TeamMonthlyMaterializationForm.tsx',
    'utf8',
  )

  assert.match(form, /processedAthletes/)
  assert.match(form, /materializedCharges/)
  assert.match(form, /t\('feedback'/)
})


test('KAN-479 athlete billing history localizes the current revision marker in ES and EN', async () => {
  const form = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.doesNotMatch(form, /['"] · vigente['"]/)
  assert.match(form, /t\('common\.current'\)/)
})


test('KAN-479 athlete H2 forms derive the billing period from the selected persisted charge', async () => {
  const form = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.doesNotMatch(form, /name=['"]reductionPeriod['"]/)
  assert.doesNotMatch(form, /name=['"]extensionPeriod['"]/)
  assert.match(form, /monthlyCharges\.find/)
  assert.match(form, /selectedCharge\.year/)
  assert.match(form, /selectedCharge\.month/)
})


test('KAN-479 athlete H2 history renders the economic value of every revision', async () => {
  const form = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.match(form, /reductionAmountMinor/)
  assert.match(form, /extendedDueDate/)
  assert.match(form, /t\('common\.withdrawn'\)/)
})


test('KAN-479 athlete H2 audit history localizes monetary amounts and dates', async () => {
  const form = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.match(form, /Intl\.NumberFormat/)
  assert.match(form, /revision\.reductionAmountMinor/)
  assert.match(form, /revision\.extendedDueDate/)
  assert.match(form, /Intl\.DateTimeFormat/)
})
