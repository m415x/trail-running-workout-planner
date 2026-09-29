import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

test('SQLite migration versions AthleteSessionAdjustment identity and revisions', () => {
  const sql = source('drizzle/sqlite/0014_athlete_session_adjustments.sql')

  assert.match(sql, /CREATE TABLE `athlete_session_adjustments`/)
  assert.match(sql, /CREATE TABLE `athlete_session_adjustment_revisions`/)
  assert.match(sql, /FOREIGN KEY \(`athlete_id`\).*athlete_profiles/)
  assert.match(sql, /FOREIGN KEY \(`source_prescription_id`\).*group_session_prescriptions/)
  assert.match(sql, /FOREIGN KEY \(`adjustment_id`\).*athlete_session_adjustments/)
  assert.match(sql, /athlete_session_adjustments_athlete_prescription_unique/)
  assert.match(sql, /athlete_session_adjustment_revisions_current_unique/)
  assert.match(sql, /WHERE .*is_current.*= 1/i)
  assert.match(sql, /athlete_session_adjustment_revisions_state_check/)
})

test('Supabase migration versions AthleteSessionAdjustment identity and revisions with RLS', () => {
  const sql = source('drizzle/supabase/0027_athlete_session_adjustments.sql')

  assert.match(sql, /CREATE TABLE "athlete_session_adjustments"/)
  assert.match(sql, /CREATE TABLE "athlete_session_adjustment_revisions"/)
  assert.match(sql, /FOREIGN KEY \("athlete_id"\).*"athlete_profiles"/)
  assert.match(sql, /FOREIGN KEY \("source_prescription_id"\).*"group_session_prescriptions"/)
  assert.match(sql, /FOREIGN KEY \("adjustment_id"\).*"athlete_session_adjustments"/)
  assert.match(sql, /athlete_session_adjustments_athlete_prescription_unique/)
  assert.match(sql, /athlete_session_adjustment_revisions_current_unique/)
  assert.match(sql, /WHERE .*is_current.*= true/i)
  assert.match(sql, /athlete_session_adjustment_revisions_state_check/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
})
