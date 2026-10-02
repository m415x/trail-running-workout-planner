import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('features/memberships/components/AthleteMembershipStatus.tsx', 'utf8')

test('KAN-573 keeps Athlete membership period, status and balance readable at narrow widths and enlarged text', () => {
  assert.match(source, /debtExperience\.blockedForPriorDebt/)
  assert.match(source, /role='alert'/)
  assert.match(source, /data-status=\{charge\.status\}/)
  assert.match(source, /formatMoney\(charge\.remainingMinor, charge\.currency\)/)

  assert.match(
    source,
    /flex flex-wrap items-start justify-between gap-3/,
    'status and balance must wrap rather than force a single horizontal row',
  )
  assert.match(
    source,
    /min-w-0/,
    'charge summary needs a shrinkable content boundary',
  )
  assert.match(
    source,
    /break-words/,
    'the balance must remain readable without clipping long localized currency output',
  )
  assert.doesNotMatch(source, /className='flex items-start justify-between gap-3'/)
})
