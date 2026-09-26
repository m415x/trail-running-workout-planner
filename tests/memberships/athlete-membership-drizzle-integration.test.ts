import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteMembershipPageLoader } from '../../lib/memberships/athlete-membership-page-loader'
import { createDrizzleBillingDatabase } from '../../lib/memberships/billing-drizzle-database'
import { createSqliteBillingPersistencePort } from '../../lib/memberships/billing-sqlite-persistence'

test('athlete membership read adapter matches the real better-sqlite3 Drizzle select API', async () => {
  const operations: string[] = []

  const db = {
    select() {
      operations.push('select')
      return {
        from() {
          operations.push('from')
          return {
            where: async () => [{ id: 'athlete-1' }],
            innerJoin() {
              return {
                where: async () => {
                  operations.push('economic-read')
                  return []
                },
              }
            },
          }
        },
      }
    },
  }

  const drizzleDatabase = createDrizzleBillingDatabase(db)
  const loadMembership = createAthleteMembershipPageLoader({
    createPort: () => createSqliteBillingPersistencePort(drizzleDatabase),
  })

  const model = await loadMembership({
    db,
    locale: 'es',
    teamId: 'team_1',
    athleteId: 'athlete-1',
    onDate: '2026-09-25',
  })

  assert.equal(model.title, 'Membresía')
  assert.equal(model.currentTerms, null)
  assert.equal(model.charges.length, 0)
  assert.ok(operations.includes('select'))
})
