import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-790 T5.5 Next Coach actions use verified PG session operations without client payload',()=>{
  const action=readFileSync('app/actions/coach-session-review-snapshot-actions.ts','utf8')
  assert.match(action,/^'use server'/)
  assert.match(action,/createAuthorizedReviewSnapshotPostgresSessionOperations/)
  assert.match(action,/createSupabaseServerClient/)
  assert.match(action,/ACTIVE_TEAM_COOKIE_NAME/)
  assert.match(action,/\.create\(\{groupTrainingPlanId:planId\}\)/)
  assert.match(action,/\.get\(\{/)
  assert.match(action,/\.confirm\(\{/)
  assert.match(action,/formData\.get\('snapshotId'\)/)
  assert.doesNotMatch(action,/formData\.get\(['"](?:proposal|generationExplanations)['"]\)/)
  assert.doesNotMatch(action,/reconcileAndPersistGeneratedSessionsSqlite/)
})
