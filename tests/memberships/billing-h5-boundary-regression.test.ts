import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('H5 stays inside memberships and does not introduce auth/session/role enforcement', () => {
  const athleteProfile = readFileSync('app/[locale]/(mobile)/profile/page.tsx', 'utf8')
  const coachPage = readFileSync('app/[locale]/dashboard/athletes/[athleteId]/page.tsx', 'utf8')
  const debtComponent = readFileSync('features/memberships/components/AthleteMembershipStatus.tsx', 'utf8')
  const accountComponent = readFileSync('features/memberships/components/MembershipAccountState.tsx', 'utf8')

  // H5 is restricted to membership surfaces; H5B SELF authorization in the enclosing Profile route is independent.
  const combined = [coachPage, debtComponent, accountComponent].join('\n')
  assert.match(athleteProfile, /getCurrentAthleteTrack1000mPerformanceAction/)

  assert.doesNotMatch(combined, /authorize|authorization|permission|roleGuard|sessionGuard/i)
  assert.doesNotMatch(combined, /blockedForPriorDebt\s*&&\s*redirect|redirect\([^)]*debt/i)
})

test('H5 uses light/dark-compatible semantic classes on Athlete and Coach signals', () => {
  const athleteUi = readFileSync('features/memberships/components/AthleteMembershipStatus.tsx', 'utf8')
  const coachUi = readFileSync('features/memberships/components/MembershipAccountState.tsx', 'utf8')

  assert.match(athleteUi, /dark:/)
  assert.match(athleteUi, /bg-background/)
  assert.match(coachUi, /dark:/)
})

test('H5 presentation is bilingual without adding a second debt calculation path', () => {
  const athleteUi = readFileSync('features/memberships/components/AthleteMembershipStatus.tsx', 'utf8')
  const coachPage = readFileSync('app/[locale]/dashboard/athletes/[athleteId]/page.tsx', 'utf8')

  assert.match(athleteUi, /Estado de membresía/)
  assert.match(athleteUi, /Membership status/)
  assert.match(coachPage, /Bloqueado por deuda vencida de un mes anterior/)
  assert.match(coachPage, /Blocked by overdue debt from a previous month/)

  assert.doesNotMatch(athleteUi, /effectiveDueDate\s*[<>=]/)
  assert.doesNotMatch(coachPage, /effectiveDueDate\s*[<>=]/)
})

test('H5 adds no schema or migration authority for debt blocking', () => {
  const schema = readFileSync('db/schema.ts', 'utf8')

  assert.doesNotMatch(schema, /blockedForPriorDebt|blocked_for_prior_debt|debtExperience|debt_experience/)
})
