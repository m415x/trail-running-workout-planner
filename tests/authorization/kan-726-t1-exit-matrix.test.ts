import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 T1 exit matrix assigns persistence and scope decisions for each H7A cut', () => {
  const matrix = readFileSync('docs/architecture/h7a-t1-writer-exit-matrix.md', 'utf8')
  for (const item of [
    'T3', 'T4', 'T5', 'T6', 'T7',
    'H2 actor source', 'H3 Team authority',
    'durable writer', 'historical evidence', 'DENY/failure',
    'legacy unknown', 'out of scope', 'atomicity',
  ]) {
    assert.ok(matrix.includes(item), 'T1 closure lacks: ' + item)
  }
})
