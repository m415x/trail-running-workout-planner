import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'db/migrations/athlete-profile-identity-sqlite.ts'),
  'utf8',
)

test('KAN-620 accepts canonical 0016 journal entry with later versioned migrations appended', () => {
  assert.match(
    source,
    /const entry = journal\.entries\[16\]/,
  )

  assert.doesNotMatch(
    source,
    /journal\.entries\.length\s*!==\s*17/,
    'canonical 0016 validation must not reject legitimate later journal entries',
  )

  assert.match(source, /entry\?\.idx\s*!==\s*16/)
  assert.match(source, /entry\.tag\s*!==\s*['"]0016_athlete_profile_identity['"]/)
  assert.match(source, /entry\.when\s*!==\s*1790802001000/)
})
