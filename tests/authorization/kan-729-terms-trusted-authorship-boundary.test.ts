import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 terms boundary forwards trusted H2/H3 authorship to both terms writers', () => {
  const source = readFileSync('lib/memberships/h6-terms-materialization-actions.ts', 'utf8')
  assert.match(source, /resolveAuthorizedH7aWriterContext\(access, result\)/)
  assert.match(source, /deps\.initializeTerms\(context\.teamId, input\.athleteId, input\.effectiveFrom, context\.authorship\)/)
  assert.match(source, /deps\.changeTerms\(context\.teamId, input\.athleteId, \{[\s\S]*?\}, context\.authorship\)/)
  assert.doesNotMatch(source, /return result\.allowed && result\.teamId \? result\.teamId : null/)
})
