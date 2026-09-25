import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('athlete detail membership block integrates the terms form from the current snapshot', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
    'utf8',
  )

  assert.match(source, /AthleteBillingTermsForm/)
  assert.match(source, /getAthleteBillingTermsFormModel/)
  assert.match(source, /membership\.currentTerms/)
  assert.match(source, /athleteId=\{athleteId\}/)
  assert.match(source, /locale=\{es \? 'es' : 'en'\}/)
  assert.doesNotMatch(source, /materializeMonthlyCharges/)
  assert.doesNotMatch(source, /insertMonthlyCharges/)
})


test('athlete detail separates current, scheduled, and past billing terms', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
    'utf8',
  )

  assert.match(source, /membership\.scheduledTerms/)
  assert.match(source, /membership\.pastTerms/)
  assert.match(source, /Cambios programados/)
  assert.match(source, /Scheduled changes/)
  assert.match(source, /Historial de condiciones/)
  assert.match(source, /Terms history/)
  assert.match(source, /Accordion/)
})


test('athlete terms form is based on the latest scheduled or current terms', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
    'utf8',
  )

  assert.match(source, /membership\.scheduledTerms\.at\(-1\) \?\? membership\.currentTerms/)
  assert.match(source, /currentTerms: membershipTermsFormBase/)
})
