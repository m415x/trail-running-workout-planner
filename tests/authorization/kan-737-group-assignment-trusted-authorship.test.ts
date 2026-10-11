import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-737 group assignment derives changedBy from canonical H2/H3 writer context', () => {
  const source = readFileSync('lib/athletes/group-assignment-action.ts', 'utf8')
  assert.match(source, /resolveAuthorizedH7aWriterContext/)
  assert.match(source, /changedByUserId:\s*writerContext\.authorship\.effectiveActorUserId/)
  assert.match(source, /teamId:\s*writerContext\.teamId/)
  assert.doesNotMatch(source, /changedByUserId:\s*access\.userId/)
})
