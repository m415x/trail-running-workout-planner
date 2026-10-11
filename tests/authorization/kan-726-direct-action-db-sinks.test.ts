import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 inventories direct database write modules under app/actions', () => {
  const document = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  const files = readdirSync('app/actions').filter((filename) => filename.endsWith('.ts'))
  const missing = files.filter((filename) => {
    const source = readFileSync('app/actions/' + filename, 'utf8')
    const writes = source.includes('.insert(') || source.includes('.update(') || source.includes('.delete(')
    return writes && !document.includes('app/actions/' + filename)
  })
  assert.deepEqual(missing, [], 'Direct database writers missing from inventory')
})
