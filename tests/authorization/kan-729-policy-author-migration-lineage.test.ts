import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 policy author migrations have canonical lineage and matching snapshots', () => {
  for (const [dialect,tag] of [['sqlite','0020_h7a_policy_author'],['supabase','0033_h7a_policy_author']] as const) {
    const journal = JSON.parse(readFileSync(`drizzle/${dialect}/meta/_journal.json`, 'utf8')) as { entries: Array<{ tag: string }> }
    assert.equal(journal.entries.at(-1)?.tag, tag, `${dialect} latest migration must be policy authorship`)
    assert.ok(existsSync(`drizzle/${dialect}/${tag}.sql`), `${dialect} SQL file missing`)
    const snapshot = `drizzle/${dialect}/meta/${tag.slice(0,4)}_snapshot.json`
    assert.ok(existsSync(snapshot), `${dialect} canonical snapshot missing`)
    const metadata = readFileSync(snapshot,'utf8')
    assert.match(metadata, /created_by_user_id/)
  }
})
