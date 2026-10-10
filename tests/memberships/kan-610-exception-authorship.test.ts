import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 global due-date exception derives H2/H3 writer authority before invoking persistence', () => {
  const source = readFileSync('lib/memberships/h6-economic-exception-actions.ts', 'utf8')
  assert.match(source, /resolveAuthorizedH7aWriterContext\(access, result\)/)
  assert.match(source, /deps\.globalDueDate\(context\.teamId, input, context\.authorship\)/)
  assert.doesNotMatch(source, /return result\.allowed && result\.teamId \? result\.teamId : null/)
})
