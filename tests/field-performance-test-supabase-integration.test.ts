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
  assert.match(sql, /"source" in \('coach_manual', 'athlete_manual', 'legacy_migration'\)/)
  assert.match(sql, /ALTER TABLE "field_performance_tests" ENABLE ROW LEVEL SECURITY/)
})


test('lifecycle migration preserves provenance and review dimensions without fabricating legacy values', () => {
  const sql = fs.readFileSync('drizzle/supabase/0019_supreme_maddog.sql', 'utf8')

  assert.match(sql, /ADD COLUMN "test_event_id" text/)
  assert.match(sql, /ADD COLUMN "execution_context" text/)
  assert.match(sql, /ADD COLUMN "recorded_by" text/)
  assert.match(sql, /ADD COLUMN "review_status" text/)
  assert.match(sql, /execution_context.+official.+self_directed/)
  assert.match(sql, /review_status.+accepted.+pending_review.+rejected/)
  assert.doesNotMatch(sql, /UPDATE "field_performance_tests"/)
  assert.doesNotMatch(sql, /ADD COLUMN "is_eligible"/)
})


test('Supabase verifier checks durable field test lifecycle columns', () => {
  const verifier = fs.readFileSync('db/supabase/verify.ts', 'utf8')

  assert.match(verifier, /field_performance_tests/)
  assert.match(verifier, /test_event_id/)
  assert.match(verifier, /execution_context/)
  assert.match(verifier, /recorded_by/)
  assert.match(verifier, /review_status/)
})


test('field test persistence defines a stable team-owned official test event', () => {
  const sqliteSchema = fs.readFileSync('db/schema.ts', 'utf8')
  const supabaseSchema = fs.readFileSync('db/supabase/field-performance-test-schema.ts', 'utf8')

  for (const schema of [sqliteSchema, supabaseSchema]) {
    assert.match(schema, /fieldPerformanceTestEvents/)
    assert.match(schema, /field_performance_test_events/)
    assert.match(schema, /teamId/)
    assert.match(schema, /groupId/)
    assert.match(schema, /scheduledAt/)
    assert.match(schema, /createdByUserId/)
    assert.match(schema, /1000m_track/)
    assert.match(schema, /testEventId[\s\S]*references\(\(\) => fieldPerformanceTestEvents\.id/)
  }
})


test('official field test events require RLS verification', () => {
  const verifier = fs.readFileSync('db/supabase/verify.ts', 'utf8')
  assert.match(verifier, /field_performance_test_events/)
})
