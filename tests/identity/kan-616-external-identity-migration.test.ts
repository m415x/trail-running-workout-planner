import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function externalIdentityMigration(dialect: 'sqlite' | 'supabase') {
  const root = path.join(process.cwd(), 'drizzle', dialect)
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ idx: number; tag: string }> }

  const entry = journal.entries.find(item =>
    item.tag === (dialect === 'sqlite'
      ? '0017_natural_fabian_cortez'
      : '0030_massive_firebird')
  )
  assert.ok(entry, `${dialect} external identity migration must exist`)

  return {
    idx: entry.idx,
    tag: entry.tag,
    sql: fs.readFileSync(path.join(root, `${entry.tag}.sql`), 'utf8'),
  }
}

for (const dialect of ['sqlite', 'supabase'] as const) {
  test(`KAN-616 versions external identity link SQL for ${dialect}`, () => {
    const migration = externalIdentityMigration(dialect)

    assert.match(migration.sql, /CREATE TABLE ["`]external_identity_links["`]/i)
    assert.match(
      migration.sql,
      /FOREIGN KEY\s*\(\s*["`]user_id["`]\s*\)[\s\S]*REFERENCES\s+(?:["`]public["`]\.)?["`]users["`]/i,
    )
    assert.match(migration.sql, /["`]provider["`]/)
    assert.match(migration.sql, /["`]subject["`]/)
    assert.match(
      migration.sql,
      /(?:UNIQUE[\s\S]*["`]provider["`][\s\S]*["`]subject["`]|external_identity_links_provider_subject_unique)/i,
    )

    if (dialect === 'sqlite') {
      assert.doesNotMatch(
        migration.sql,
        /(?:__new_athlete_profiles|\bDROP TABLE\s+["`]athlete_profiles["`]|\bALTER TABLE\s+["`]__new_athlete_profiles["`])/i,
        'KAN-616 migration must not rebuild athlete_profiles',
      )
    }
  })
}
