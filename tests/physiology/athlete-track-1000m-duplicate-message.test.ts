import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('athlete duplicate official evidence uses a user-facing ES/EN message', () => {
  const source = readFileSync(
    'features/field-performance-test/components/AthleteTrack1000mForm.tsx',
    'utf8',
  )

  assert.match(source, /error === 'official_evidence_already_exists'/)
  assert.match(source, /Ya registraste un resultado para esta instancia oficial\./)
  assert.match(source, /You already recorded a result for this official test event\./)
})
