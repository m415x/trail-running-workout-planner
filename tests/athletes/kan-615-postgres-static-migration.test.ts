import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-615 PostgreSQL has versioned static AthleteProfile migration 0029', () => {
  const journal = JSON.parse(
    readFileSync('drizzle/supabase/meta/_journal.json', 'utf8'),
  ) as {
    entries: Array<{
      idx: number
      version: string
      when: number
      tag: string
    }>
  }

  assert.equal(journal.entries.length, 30)

  const previous = journal.entries[28]
  const current = journal.entries[29]

  assert.equal(previous.idx, 28)
  assert.equal(previous.tag, '0028_generation_explanation_provenance')

  assert.equal(current.idx, 29)
  assert.equal(current.version, '7')
  assert.equal(current.tag, '0029_athlete_profile_identity')
  assert.ok(current.when > previous.when)

  const sql = readFileSync(
    `drizzle/supabase/${current.tag}.sql`,
    'utf8',
  )

  assert.match(sql, /ADD COLUMN[\\s\\S]*"first_name"/i)
  assert.match(sql, /ADD COLUMN[\\s\\S]*"last_name"/i)
  assert.match(sql, /ADD COLUMN[\\s\\S]*"contact_email"/i)

  assert.match(sql, /UPDATE\s+"athlete_profiles"/i)
  assert.match(sql, /FROM\s+"users"/i)
  assert.match(sql, /"user_id"\s*=\s*.*"id"/i)

  assert.match(sql, /ALTER COLUMN "user_id" DROP NOT NULL/i)
  assert.match(sql, /DROP CONSTRAINT "athlete_profiles_user_id_unique"/i)
  assert.match(sql, /athlete_profiles_user_team_unique/i)
  assert.match(sql, /ON DELETE RESTRICT/i)

  assert.doesNotMatch(sql, /\bDROP TABLE\b/i)
  assert.doesNotMatch(sql, /\bTRUNCATE\b/i)
  assert.doesNotMatch(sql, /\bDELETE FROM\b/i)
})
