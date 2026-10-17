import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

test('KAN-789 schema generator includes both SQLite and PostgreSQL snapshot models', () => {
  assert.match(readFileSync('drizzle.config.ts', 'utf8'), /session-generation-review-snapshot-schema/)
  assert.match(readFileSync('drizzle.supabase.config.ts', 'utf8'), /session-generation-review-snapshot-schema/)
})

test('KAN-789 journal head has matching chain of physical migration snapshots', () => {
  for (const [root, chain] of [
    ['drizzle/sqlite', [
      ['0025', null],
      ['0026', '0026_session_generation_review_snapshots'],
    ]],
    ['drizzle/supabase', [
      ['0038', null],
      ['0039', '0039_session_generation_review_snapshots'],
      ['0040', '0040_session_generation_preferences'],
    ]],
  ] as const) {
    const dir = root + '/meta/'
    const journal = JSON.parse(readFileSync(dir + '_journal.json', 'utf8'))
    assert.ok(journal.entries.some((entry: {tag:string}) => entry.tag === chain.at(-1)?.[1]), 'Historical session-generation migration remains canonical')
    for (let i = 1; i < chain.length; i++) {
      const [before] = chain[i - 1]
      const [after, name] = chain[i]
      assert.ok(journal.entries.some((entry: {tag:string}) => entry.tag === name))
      assert.ok(existsSync(dir + after + '_snapshot.json'))
      const oldSnapshot = JSON.parse(readFileSync(dir + before + '_snapshot.json', 'utf8'))
      const newSnapshot = JSON.parse(readFileSync(dir + after + '_snapshot.json', 'utf8'))
      assert.equal(newSnapshot.prevId, oldSnapshot.id)
      assert.ok(Object.keys(newSnapshot.tables).some(key =>
        key.endsWith('session_generation_review_snapshots')))
    }
  }
})
