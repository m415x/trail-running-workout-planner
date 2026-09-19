import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('Supabase generation includes field performance schema', () => {
  const config = fs.readFileSync('drizzle.supabase.config.ts', 'utf8')
  assert.match(config, /\.\/db\/supabase\/field-performance-test-schema\.ts/)
})

test('Supabase verifier treats field performance evidence as an RLS-protected application table', () => {
  const verifier = fs.readFileSync('db/supabase/verify.ts', 'utf8')
  assert.match(verifier, /'field_performance_tests'/)
})

test('versioned migration creates field performance evidence and enables RLS', () => {
  const migrations = fs
    .readdirSync('drizzle/supabase')
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()
  const sql = migrations
    .map((name) => fs.readFileSync(`drizzle/supabase/${name}`, 'utf8'))
    .join('\n')

  assert.match(sql, /CREATE TABLE "field_performance_tests"/)
  assert.match(sql, /FOREIGN KEY \("athlete_id"\) REFERENCES "public"\."athlete_profiles"\("id"\) ON DELETE cascade/)
  assert.match(sql, /CREATE INDEX "field_performance_tests_athlete_date_idx"/)
  assert.match(sql, /"source" text NOT NULL/)
  assert.match(sql, /field_performance_tests_source_check/)
  assert.match(sql, /"source" in \('coach_manual', 'legacy_migration'\)/)
  assert.match(sql, /ALTER TABLE "field_performance_tests" ENABLE ROW LEVEL SECURITY/)
})
