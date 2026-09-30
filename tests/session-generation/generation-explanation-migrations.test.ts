import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()
const sqliteMigrationPath = path.join(
  root,
  'drizzle/sqlite/0015_generation_explanation_provenance.sql',
)
const supabaseMigrationPath = path.join(
  root,
  'drizzle/supabase/0028_generation_explanation_provenance.sql',
)

describe('GenerationExplanation historical persistence migrations', () => {
  it('adds one nullable historical snapshot column in SQLite without touching planning tables', () => {
    const sql = fs.readFileSync(sqliteMigrationPath, 'utf8')

    assert.match(
      sql,
      /ALTER TABLE `session_generation_modification_records` ADD `generation_explanation` text/i,
    )
    assert.doesNotMatch(sql, /generation_explanation[^;]*NOT NULL/i)
    assert.doesNotMatch(sql, /generation_explanation[^;]*DEFAULT/i)
    assert.doesNotMatch(sql, /ALTER TABLE `sessions`/i)
    assert.doesNotMatch(sql, /ALTER TABLE `group_session_prescriptions`/i)
  })

  it('adds the equivalent nullable JSONB snapshot in Supabase', () => {
    const sql = fs.readFileSync(supabaseMigrationPath, 'utf8')

    assert.match(
      sql,
      /ALTER TABLE "session_generation_modification_records" ADD COLUMN "generation_explanation" jsonb/i,
    )
    assert.doesNotMatch(sql, /generation_explanation[^;]*NOT NULL/i)
    assert.doesNotMatch(sql, /generation_explanation[^;]*DEFAULT/i)
    assert.doesNotMatch(sql, /ALTER TABLE "sessions"/i)
    assert.doesNotMatch(sql, /ALTER TABLE "group_session_prescriptions"/i)
  })

  it('registers both migrations as canonical HEAD entries', () => {
    const sqliteJournal = JSON.parse(
      fs.readFileSync(path.join(root, 'drizzle/sqlite/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> }
    const supabaseJournal = JSON.parse(
      fs.readFileSync(path.join(root, 'drizzle/supabase/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> }

    assert.equal(
      sqliteJournal.entries.at(-1)?.tag,
      '0015_generation_explanation_provenance',
    )
    assert.equal(
      supabaseJournal.entries.at(-1)?.tag,
      '0028_generation_explanation_provenance',
    )
  })

  it('requires SQLite HEAD verification to include the historical provenance column', () => {
    const verifier = fs.readFileSync(
      path.join(root, 'scripts/verify-sqlite.ts'),
      'utf8',
    )

    assert.match(verifier, /session_generation_modification_records/)
    assert.match(verifier, /generation_explanation/)
  })
})
