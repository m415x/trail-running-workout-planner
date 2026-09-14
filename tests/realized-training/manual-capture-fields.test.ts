import assert from 'node:assert/strict'
import { it } from 'node:test'
import { captureDuration, captureLocalInstant } from '@/lib/realized-training/manual-capture-fields'
import { isValidPerformedAt } from '@/lib/realized-training/capture-contract'
import { workoutLogs as sqliteLogs } from '@/db/schema'
import { workoutLogs as postgresLogs } from '@/db/supabase/schema'

it('keeps SQLite and PostgreSQL timing schemas compatible without a fabricated default', () => {
  assert.equal(sqliteLogs.durationMin.getSQLType(), 'real')
  assert.equal(postgresLogs.durationMin.getSQLType(), 'double precision')
  for (const table of [sqliteLogs, postgresLogs]) {
    assert.equal(table.performedAt.getSQLType(), 'text')
    assert.equal(table.performedAt.notNull, false)
    assert.equal(table.performedAt.hasDefault, false)
    assert.equal(table.date.notNull, true)
    assert.equal(table.loggedAt.notNull, true)
  }
})

it('preserves one second, known zero and untouched duration separately', () => {
  assert.deepEqual(captureDuration('','',''), {state:'unknown'})
  assert.deepEqual(captureDuration('','','0'), {state:'known',value:0})
  assert.deepEqual(captureDuration('1','1','1'), {state:'known',value:61+1/60})
  assert.deepEqual(captureDuration('-1','2','0'), {state:'known',value:NaN})
})

it('requires an actual explicit-offset instant and rejects impossible dates', () => {
  for (const value of [null,undefined,'','2026-02-30T08:00:00Z','2026-09-13T25:00:00Z','2026-09-13T08:00:00']) {
    assert.equal(isValidPerformedAt(value),false)
  }
  assert.equal(isValidPerformedAt('2026-09-13T23:30:00-03:00'),true)
  assert.equal(captureLocalInstant(''),null)
  assert.equal(captureLocalInstant('2026-02-30T08:00'),null)
  assert.equal(captureLocalInstant('2026-09-13T08:30'),new Date(2026,8,13,8,30).toISOString())
})
