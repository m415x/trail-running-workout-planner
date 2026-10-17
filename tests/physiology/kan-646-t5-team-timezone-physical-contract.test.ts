import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-646 T5 regional contract: SQLite and PostgreSQL persist nullable Team IANA zone without defaults', () => {
  for (const path of ['db/schema.ts', 'db/supabase/schema.ts']) {
    const schema = read(path)
    const section = schema.slice(schema.indexOf('export const teams ='), schema.indexOf('export const trainingLocations ='))
    assert.match(section, /timeZone:\s*text\('time_zone'\)/, path + ': Teams must have nullable timeZone')
    assert.doesNotMatch(section, /timeZone:[^\n]*\.notNull\(|timeZone:[^\n]*\.default\(/,
      path + ': existing Teams must stay unprovisioned')
  }
})

test('KAN-646 T5 regional contract: new observations capture immutable zone provenance in both DB schemas', () => {
  for (const path of [
    'db/athlete-biometric-observation-schema.ts',
    'db/supabase/athlete-biometric-observation-schema.ts',
  ]) {
    const schema = read(path)
    assert.match(schema, /observedTimeZone:\s*text\('observed_time_zone'\)/,
      path + ': immutable timezone of observation must be available')
    assert.doesNotMatch(schema, /observedTimeZone:[^\n]*\.default\(/,
      path + ': historical observations must not be assigned inferred zone')
  }
})

test('KAN-646 T5 regional contract: Drizzle migration journals append canonical numbers without rewriting old migrations', () => {
  const sqlite = JSON.parse(read('drizzle/sqlite/meta/_journal.json')) as { entries: { idx: number; tag: string }[] }
  const pg = JSON.parse(read('drizzle/supabase/meta/_journal.json')) as { entries: { idx: number; tag: string }[] }
  const latestSqlite = sqlite.entries.at(-1)
  const latestPg = pg.entries.at(-1)
  assert.equal(latestSqlite?.idx, 28)
  assert.match(latestSqlite?.tag ?? '', /^0028_/)
  assert.equal(latestPg?.idx, 42)
  assert.match(latestPg?.tag ?? '', /^0042_/)
  assert.match(read('drizzle/sqlite/' + latestSqlite?.tag + '.sql'), /ALTER TABLE ["`]?teams["`]? ADD (?:COLUMN )?["`]?time_zone["`]?/i)
  assert.match(read('drizzle/supabase/' + latestPg?.tag + '.sql'), /ALTER TABLE ["`]?teams["`]? ADD (?:COLUMN )?["`]?time_zone["`]?/i)
})
