import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 policy boundary carries canonical H2/H3 author through configure callback', () => {
  const source = readFileSync('lib/memberships/h6-policy-action.ts', 'utf8')
  assert.match(source, /resolveAuthorizedH7aWriterContext\(access, decision\)/)
  assert.match(source, /deps\.configure\(writerContext\.teamId, input, writerContext\.authorship\)/)
  assert.doesNotMatch(source, /deps\.configure\(decision\.teamId, input\)/)
})
