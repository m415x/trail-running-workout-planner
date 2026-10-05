import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function latestMigration(dialect: 'sqlite' | 'supabase') {
  const root = path.join(process.cwd(), 'drizzle', dialect)
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ idx: number; tag: string }> }

  const latest = journal.entries.at(-1)
  assert.ok(latest, `${dialect} migration journal is not empty`)

  return {
    idx: latest.idx,
    tag: latest.tag,
    sql: fs.readFileSync(path.join(root, `${latest.tag}.sql`), 'utf8'),
  }
}

for (const dialect of ['sqlite', 'supabase'] as const) {
  test(`KAN-617 versions TeamMembership without legacy-role authority for ${dialect}`, () => {
    const migration = latestMigration(dialect)

    assert.match(migration.sql, /CREATE TABLE ["`]team_memberships["`]/i)
    assert.match(
      migration.sql,
      /FOREIGN KEY\s*\(\s*["`]user_id["`]\s*\)[\s\S]*REFERENCES\s+(?:["`]public["`]\.)?["`]users["`]/i,
    )
    assert.match(
      migration.sql,
      /FOREIGN KEY\s*\(\s*["`]team_id["`]\s*\)[\s\S]*REFERENCES\s+(?:["`]public["`]\.)?["`]teams["`]/i,
    )
    assert.match(migration.sql, /["`]preset["`]/i)
    assert.match(migration.sql, /["`]effective_from["`]/i)
    assert.match(migration.sql, /["`]effective_until["`]/i)
    assert.match(migration.sql, /["`]is_active["`]/i)

    assert.doesNotMatch(
      migration.sql,
      /INSERT\s+INTO\s+["`]team_memberships["`][\s\S]*(?:users|athlete_profiles)/i,
      'KAN-617 must not infer organizational authority from legacy role or sporting membership',
    )
    assert.doesNotMatch(
      migration.sql,
      /(?:ALTER|DROP)\s+TABLE\s+["`]users["`]/i,
      'KAN-617 keeps users.role only as inert legacy data',
    )
  })
}
