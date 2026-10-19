import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const legacy = readFileSync('app/actions/session-generation-actions.ts','utf8')
const action = readFileSync('app/actions/coach-session-review-snapshot-actions.ts','utf8')
const authority = readFileSync('lib/session-generation/authorized-review-snapshot-postgres-transaction.ts','utf8')
const writer = readFileSync('lib/session-generation/review-snapshot-reconciliation-writer-postgres.ts','utf8')
describe('KAN-678 scope and reconciliation preserved in PG snapshot flow', () => {
  it('requires verified H2 session and server-owned H3 Team before PG mutations', () => {
    assert.match(action,/createSupabaseServerClient/)
    assert.match(action,/ACTIVE_TEAM_COOKIE_NAME/)
    assert.match(action,/createAuthorizedReviewSnapshotPostgresSessionOperations/)
    assert.doesNotMatch(legacy,/reconcileAndPersistGeneratedSessionsSqlite/)
  })
  it('authorizes complete affected audience and validates Plan ownership', () => {
    assert.match(authority,/authorizeEffectiveCapability/)
    assert.match(authority,/readAffectedGroupIds/)
    assert.match(authority,/planning\.manage/)
    assert.match(authority,/group_training_plans/)
    assert.match(authority,/athlete_groups/)
  })
  it('protects manual ownership while writing Session prescriptions and audits transactionally', () => {
    assert.match(writer,/authorizedGroupIds\.has/)
    assert.match(writer,/generated_modified/)
    assert.match(writer,/group_session_prescriptions/)
    assert.match(writer,/session_generation_modification_records/)
    assert.match(authority,/createReviewSnapshotPostgresReconciliationPersist/)
  })
})
