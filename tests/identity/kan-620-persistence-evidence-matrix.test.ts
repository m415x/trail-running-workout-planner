import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const matrixPath = path.join(
  process.cwd(),
  'docs/research/kan-601-persistence-evidence.md',
)

test('KAN-620 records an explicit persistence evidence matrix with honest execution classes', () => {
  assert.ok(
    fs.existsSync(matrixPath),
    'KAN-620 persistence evidence matrix must exist',
  )

  const matrix = fs.readFileSync(matrixPath, 'utf8')

  for (const required of [
    'PURE',
    'SQLITE REAL',
    'POSTGRESQL STATIC',
    'POSTGRESQL REAL',
    'drift',
    'upgrade',
    'rerun',
    'preservation',
    'pending',
  ]) {
    assert.match(matrix, new RegExp(required, 'i'))
  }

  assert.match(
    matrix,
    /POSTGRESQL REAL[\s\S]*pending/i,
    'real PostgreSQL must remain explicitly pending',
  )

  assert.doesNotMatch(
    matrix,
    /POSTGRESQL REAL[\s\S]{0,120}(?:green|pass|verified)/i,
    'KAN-620 must not attribute synthetic/static evidence to real PostgreSQL',
  )

  for (const evidenceFile of [
    'tests/athletes/kan-615-sqlite-preservation-upgrade.test.ts',
    'tests/athletes/kan-615-sqlite-operational-rerun.test.ts',
    'tests/athletes/kan-615-sqlite-applied-column-drift.test.ts',
    'tests/athletes/kan-615-postgres-static-migration.test.ts',
    'tests/identity/kan-616-external-identity-migration.test.ts',
    'tests/identity/kan-617-team-membership-migration.test.ts',
    'tests/identity/kan-619-history-preservation.test.ts',
  ]) {
    const escaped = evidenceFile.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')
    assert.match(matrix, new RegExp(escaped))
  }
})
