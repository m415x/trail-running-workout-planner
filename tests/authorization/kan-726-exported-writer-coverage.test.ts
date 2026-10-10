import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sources = [
  'app/actions/athlete-actions.ts',
  'app/actions/group-actions.ts',
  'app/actions/planning-cohort-actions.ts',
  'app/actions/membership-actions.ts',
  'app/actions/field-performance-test-actions.ts',
  'lib/memberships/billing-coach-actions.ts',
  'lib/physiology/field-performance-test-application.ts',
] as const

test('KAN-726 matches actual exported mutation functions against durable writer inventory', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  const uncovered: string[] = []
  for (const source of sources) {
    const code = readFileSync(source, 'utf8')
    const names = [...code.matchAll(/export\s+(?:async\s+)?function\s+((?:create|update|set|assign|close|derive|configure|apply|materialize|register|correct|void|review)[A-Za-z0-9_]*)\s*\(/g)]
      .map((match) => match[1])
    for (const name of names) {
      if (!inventory.includes(name)) uncovered.push(source + ' :: ' + name)
    }
  }
  assert.deepEqual(uncovered, [], 'Real exported mutation writers missing from H7A inventory')
})
