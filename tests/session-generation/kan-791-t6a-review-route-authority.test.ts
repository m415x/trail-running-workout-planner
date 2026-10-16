import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

test('KAN-791 T6-A Coach PostgreSQL review route has no SQLite authority or editors', () => {
  const route='app/[locale]/dashboard/planning/[planId]/review/page.tsx'
  assert.ok(existsSync(route),'Dedicated Coach snapshot review route is required')
  const code=readFileSync(route,'utf8')
  assert.match(code,/getCoachPostgresReviewPlanContext/)
  assert.match(code,/getTranslations/)
  assert.doesNotMatch(code,/from ['"]@\/db['"]|getGroupTrainingPlanById|getSessionGenerationPreferencesForPlan|getWorkoutTemplates|getCompetitionCalendarAction/)
  assert.doesNotMatch(code,/Microcycle(?:Dates|Type|Notes|Elevation|Volume)Form|SessionGenerationPreferencesForm|LoadProgressionPreview|CatalogCompetitionForm/)
})

test('KAN-791 T6-A Plan context delegates to existing transaction-bound PG H2 H3 H4A authorization', () => {
  const session=readFileSync('lib/session-generation/authorized-review-snapshot-postgres-session.ts','utf8')
  const transaction=readFileSync('lib/session-generation/authorized-review-snapshot-postgres-transaction.ts','utf8')
  assert.match(session,/createAuthorizedReviewSnapshotPostgresTransactionOperations/)
  assert.match(transaction,/async getPlanContext\(/)
  assert.match(transaction,/await check\(tx,/)
  assert.match(transaction,/SET TRANSACTION ISOLATION LEVEL SERIALIZABLE/)
})
