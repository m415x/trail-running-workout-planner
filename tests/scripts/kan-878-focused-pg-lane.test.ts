import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertKan878FocusedAcceptanceLane } from '../../scripts/tdd'

const dedicated = 'tests/sessions/vertical-prescription-postgres-real-acceptance.test.ts'
const safeEnv = {
  KAN878_PG_URL: 'postgresql://fixture:fixture@127.0.0.1:55478/kan878_vertical_disposable',
}

test('KAN-878 RED-16 focused runner routes dedicated real PG acceptance to its isolated guard', () => {
  assert.equal(assertKan878FocusedAcceptanceLane([dedicated], safeEnv), true)
  assert.equal(assertKan878FocusedAcceptanceLane([dedicated.replaceAll('/', '\\\\')], safeEnv), true)

  assert.throws(
    () => assertKan878FocusedAcceptanceLane([dedicated], {}),
    /BLOCKED|KAN878_PG_URL|required/i,
    'Absent KAN-878 credentials must block the dedicated PG acceptance lane',
  )
  assert.throws(
    () => assertKan878FocusedAcceptanceLane([dedicated], {
      KAN878_PG_URL: 'postgresql://fixture:fixture@127.0.0.1:55439/kan791_regression_disposable',
    }),
    /BLOCKED|unauthoriz/i,
    'KAN-791 database must never be accepted for KAN-878',
  )

  assert.equal(assertKan878FocusedAcceptanceLane([
    'tests/sessions/vertical-prescription-postgres-writer.test.ts',
  ], {}), false, 'SQL-double unit tests must not demand a real connection')

  assert.equal(assertKan878FocusedAcceptanceLane([
    'tests/sessions/vertical-prescription-postgres-real-acceptance.test.ts',
    'tests/sessions/vertical-prescription-postgres-writer.test.ts',
  ], safeEnv), true)
})
