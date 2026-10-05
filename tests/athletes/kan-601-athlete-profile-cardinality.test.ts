import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

/**
 * KAN-601/T2 schema contract only. The separate SQLite upgrade/preservation
 * suite and authorized real PostgreSQL verification remain mandatory.
 */
for (const schemaPath of ['db/schema.ts', 'db/supabase/schema.ts']) {
  test(`KAN-601/T2 athlete identity cardinality in ${schemaPath}`, () => {
    const source = fs.readFileSync(path.join(process.cwd(), schemaPath), 'utf8')
    const start = source.indexOf('export const athleteProfiles =')
    const end = source.indexOf('export const planningCohortMemberships =', start)
    assert.ok(start >= 0 && end > start, 'athlete profile schema section exists')
    const section = source.slice(start, end)

    assert.match(section, /userId:\s*text\('user_id'\)/)
    assert.doesNotMatch(
      section,
      /userId:\s*text\('user_id'\)\s*\.notNull\(\)/,
      'an athlete can exist without an EPT User',
    )
    assert.doesNotMatch(
      section,
      /userId:\s*text\('user_id'\)(?:\s*\.notNull\(\))?\s*\.unique\(\)/,
      'a user can have athletes in different teams',
    )
    assert.match(
      section,
      /uniqueIndex\([^)]*\)[\s\S]*?\.on\(table\.userId,\s*table\.teamId\)/,
      'at most one athlete profile per linked user and team, including inactive',
    )
    assert.doesNotMatch(
      section,
      /\.references\(\(\) => users\.id,\s*\{\s*onDelete:\s*'cascade'/,
      'deleting an EPT User cannot cascade-delete sporting history',
    )
  })
}
