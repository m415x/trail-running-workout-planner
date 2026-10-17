import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-646/T5 SQLite and PostgreSQL model the isolated, append-only self-declared observations', () => {
  for (const schema of ['db/schema.ts', 'db/supabase/schema.ts']) {
    const source = read(schema)
    assert.match(source, /athlete_biometric_observations/)
    assert.match(source, /supersedes_observation_id/)
    assert.match(source, /recorded_by_user_id/)
    assert.match(source, /observed_on/)
    assert.match(source, /recorded_at/)
    assert.match(source, /operation_key/)
    assert.match(source, /request_digest/)
  }
})

test('KAN-646/T5 physical migration follows reconciled canonical heads in both dialects', () => {
  for (const [root, previous, next, tag] of [
    ['drizzle/sqlite', '0026', '0027', '0027_athlete_biometric_observations'],
    ['drizzle/supabase', '0040', '0041', '0041_athlete_biometric_observations'],
  ] as const) {
    const entries = JSON.parse(read(root + '/meta/_journal.json')).entries as {tag:string}[]
    assert.equal(entries.at(-1)?.tag, tag)
    const before = JSON.parse(read(root + '/meta/' + previous + '_snapshot.json'))
    const after = JSON.parse(read(root + '/meta/' + next + '_snapshot.json'))
    assert.equal(after.prevId, before.id)
    assert.ok(Object.keys(after.tables).some((key) => key.endsWith('athlete_biometric_observations')))
    const sql = read(root + '/' + tag + '.sql')
    assert.match(sql, /athlete_biometric_observations/)
    assert.match(sql, /supersedes_observation_id/)
    assert.match(sql, /UNIQUE/i)
    assert.match(sql, /CHECK/i)
  }
})
