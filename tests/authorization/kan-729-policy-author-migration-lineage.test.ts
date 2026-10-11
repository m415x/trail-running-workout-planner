import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 policy author migrations have canonical lineage and matching snapshots', () => {
  for (const [dialect,tag] of [['sqlite','0020_h7a_policy_author'],['supabase','0033_h7a_policy_author']] as const) {
    const journal = JSON.parse(readFileSync(`drizzle/${dialect}/meta/_journal.json`, 'utf8')) as { entries: Array<{ tag: string }> }
    const policyIndex = journal.entries.findIndex((entry) => entry.tag === tag)
    const termsTag = dialect === 'sqlite' ? '0021_h7a_terms_author' : '0034_h7a_terms_author'
    const termsIndex = journal.entries.findIndex((entry) => entry.tag === termsTag)
    assert.ok(policyIndex >= 0, `${dialect} policy authorship migration must remain in journal`)
    assert.equal(journal.entries.filter((entry) => entry.tag === tag).length, 1, `${dialect} policy authorship migration must be unique`)
    assert.equal(termsIndex, policyIndex + 1, `${dialect} terms authorship must follow policy authorship`)
    assert.equal(journal.entries.filter((entry) => entry.tag === termsTag).length, 1, `${dialect} terms authorship migration must be unique`)
    assert.ok(existsSync(`drizzle/${dialect}/${tag}.sql`), `${dialect} SQL file missing`)
    const snapshot = `drizzle/${dialect}/meta/${tag.slice(0,4)}_snapshot.json`
    assert.ok(existsSync(snapshot), `${dialect} canonical snapshot missing`)
    const metadata = readFileSync(snapshot,'utf8')
    assert.match(metadata, /created_by_user_id/)
  }
})
