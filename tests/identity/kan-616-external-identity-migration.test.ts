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
  test(`KAN-616 versions external identity link SQL for ${dialect}`, () => {
    const migration = latestMigration(dialect)

    assert.match(migration.sql, /CREATE TABLE ["`]external_identity_links["`]/i)
    assert.match(migration.sql, /["`]user_id["`][\s\S]*REFERENCES ["`](?:public["`]\.)?["`]users["`]/i)
    assert.match(migration.sql, /["`]provider["`]/)
    assert.match(migration.sql, /["`]subject["`]/)
    assert.match(
      migration.sql,
      /(?:UNIQUE[\s\S]*["`]provider["`][\s\S]*["`]subject["`]|external_identity_links_provider_subject_unique)/i,
    )
  })
}
