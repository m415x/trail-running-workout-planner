import assert from 'node:assert/strict'
import test from 'node:test'

import { readFile } from 'node:fs/promises'

test('athlete detail page renders the H1 membership block from the scoped read-only loader', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
    'utf8',
  )

  assert.match(source, /createAthleteMembershipPageLoader/)
  assert.match(source, /createDrizzleBillingDatabase/)
  assert.match(source, /createSqliteBillingPersistencePort/)
  assert.match(source, /teamId:\s*athlete\.teamId/)
  assert.match(source, /athleteId/)
  assert.match(source, /Membership/)
  assert.match(source, /membership\.currentTerms/)
  assert.match(source, /membership\.charges/)
  assert.doesNotMatch(source, /materializeMonthlyCharges/)
  assert.doesNotMatch(source, /insertMonthlyCharges/)
})
