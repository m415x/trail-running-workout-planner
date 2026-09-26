import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSqliteBillingPersistencePort,
  type SqliteBillingDatabase,
} from '../../lib/memberships/billing-sqlite-persistence'

test('SQLite billing persistence port scopes athlete economic reads through athlete team membership', async () => {
  const calls: string[] = []
  const db = {
    athleteBelongsToTeam: async (teamId: string, athleteId: string) => {
      calls.push(`belongs:${teamId}:${athleteId}`)
      return true
    },
    listBillingTerms: async (teamId: string, athleteId: string) => {
      calls.push(`terms:${teamId}:${athleteId}`)
      return []
    },
    listMonthlyCharges: async (teamId: string, athleteId: string) => {
      calls.push(`charges:${teamId}:${athleteId}`)
      return []
    },
    listTeamEconomicPolicies: async (teamId: string) => {
      calls.push(`policies:${teamId}`)
      return []
    },
    insertMonthlyCharges: async () => {},
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {},
  } satisfies SqliteBillingDatabase

  const port = createSqliteBillingPersistencePort(db)

  assert.equal(await port.athleteBelongsToTeam('team-a', 'athlete-a'), true)
  await port.listBillingTerms('team-a', 'athlete-a')
  await port.listMonthlyCharges('team-a', 'athlete-a')
  await port.listTeamEconomicPolicies('team-a')

  assert.deepEqual(calls, [
    'belongs:team-a:athlete-a',
    'terms:team-a:athlete-a',
    'charges:team-a:athlete-a',
    'policies:team-a',
  ])
})

test('SQLite billing persistence port persists only charges belonging to the requested athlete', async () => {
  const inserted: string[] = []
  const db = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async (_teamId: string, athleteId: string, charges: Array<{ athleteId: string }>) => {
      assert.ok(charges.every((charge) => charge.athleteId === athleteId))
      inserted.push(...charges.map((charge) => charge.athleteId))
    },
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {},
  } satisfies SqliteBillingDatabase

  const port = createSqliteBillingPersistencePort(db)

  await port.insertMonthlyCharges('team-a', 'athlete-a', [{
    athleteId: 'athlete-a',
    billingTermsId: 'terms-a',
    year: 2026,
    month: 10,
    baseAmountMinor: 2_500_000,
    amountDueMinor: 2_500_000,
    currency: 'ARS',
    baseDueDate: '2026-10-18',
    effectiveDueDate: '2026-10-18',
  }])

  assert.deepEqual(inserted, ['athlete-a'])

  await assert.rejects(
    () => port.insertMonthlyCharges('team-a', 'athlete-a', [{
      athleteId: 'athlete-b',
      billingTermsId: 'terms-b',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-18',
      effectiveDueDate: '2026-10-18',
    }]),
    /athlete.*scope/i,
  )
})


test('SQLite billing persistence exposes append-only global due-date exception revision operations', async () => {
  const calls: string[] = []
  const db = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listGlobalDueDateExceptionRevisions: async (teamId: string, year: number, month: number) => {
      calls.push(`list:${teamId}:${year}:${month}`)
      return []
    },
    replaceCurrentGlobalDueDateException: async (
      teamId: string,
      year: number,
      month: number,
      revision: {
        id: string
        teamId: string
        year: number
        month: number
        dueDate: string
        reason: string
        isCurrent: boolean
      },
    ) => {
      calls.push(`replace:${teamId}:${year}:${month}:${revision.id}`)
    },
  } satisfies SqliteBillingDatabase

  const port = createSqliteBillingPersistencePort(db)

  assert.deepEqual(
    await port.listGlobalDueDateExceptionRevisions('team-a', 2026, 10),
    [],
  )
  await port.replaceCurrentGlobalDueDateException('team-a', 2026, 10, {
    id: 'exception-1',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Vencimiento excepcional',
    isCurrent: true,
  })

  assert.deepEqual(calls, [
    'list:team-a:2026:10',
    'replace:team-a:2026:10:exception-1',
  ])
})

test('SQLite billing persistence rejects a global due-date revision outside the requested team period', async () => {
  const db = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {},
  } satisfies SqliteBillingDatabase

  const port = createSqliteBillingPersistencePort(db)

  await assert.rejects(
    () => port.replaceCurrentGlobalDueDateException('team-a', 2026, 10, {
      id: 'exception-foreign',
      teamId: 'team-b',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Otro equipo',
      isCurrent: true,
    }),
    /team|period|scope|identity/i,
  )
})
