import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertKan878FocusedAcceptanceLane } from '../../scripts/tdd'
import { isKan878AcceptanceFile } from '../../scripts/kan-878-postgres-acceptance-target'
import { partitionTestFiles, selectMutablePostgresRegressionFiles } from '../../scripts/test-runner'

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

test('KAN-882 reuses the exact KAN-878 disposable focused lane', () => {
  const file = 'tests/session-generation/kan-882-vertical-regeneration-postgres.test.ts'
  assert.equal(assertKan878FocusedAcceptanceLane([file], safeEnv), true)
  assert.throws(() => assertKan878FocusedAcceptanceLane([file], {}), /BLOCKED/)
})


test('KAN-884 dedicated acceptance cannot silently run under a generic PostgreSQL lane or ordinary gate', async () => {
  const t6 = 'tests/session-generation/kan-882-vertical-regeneration-postgres.test.ts'
  const ordinary = 'tests/sessions/vertical-prescription-postgres-writer.test.ts'
  const lanes = await partitionTestFiles([dedicated, t6, ordinary])
  assert.deepEqual(lanes.ordinary, [ordinary])
  assert.deepEqual(lanes.postgres, [dedicated, t6])
  const generic = 'tests/session-generation/kan-790-pg4-fixture.test.ts'
  const annual = 'tests/session-generation/kan-791-annual-239-postgres-effective-source.test.ts'
  assert.deepEqual(selectMutablePostgresRegressionFiles([dedicated, t6, generic, annual]), [generic])
  assert.equal(isKan878AcceptanceFile('tests/other/vertical-prescription-postgres-real-acceptance.test.ts'), false)
  assert.throws(() => assertKan878FocusedAcceptanceLane(['tests/sessions/*.test.ts'], {}), /BLOCKED/)
  assert.throws(() => assertKan878FocusedAcceptanceLane(['tests/session-generation/kan-882-*.test.ts'], safeEnv), /BLOCKED/)
  assert.equal(assertKan878FocusedAcceptanceLane(['tests/sessions/session-*.test.ts'], {}), false)
})
