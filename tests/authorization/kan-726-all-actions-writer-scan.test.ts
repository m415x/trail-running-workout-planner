import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

const inventory = 'docs/architecture/h7a-sensitive-writer-inventory.md'
const verbs = /export\s+(?:async\s+)?function\s+((?:create|update|set|assign|close|derive|configure|apply|materialize|register|correct|void|review|revoke|grant|delete|remove)[A-Za-z0-9_]*)\s*\(/g

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

test('KAN-726 surveys ALL exported action mutation entrypoints rather than seven selected modules', () => {
  const doc = readFileSync(inventory, 'utf8')
  const missing: string[] = []
  const actions = walk('app/actions')
  for (const source of actions) {
    const code = readFileSync(source, 'utf8')
    const names = [...code.matchAll(verbs)].map((match) => match[1])
    for (const name of names) {
      if (!doc.includes(name)) missing.push(relative('.', source) + ' :: ' + name)
    }
  }
  assert.deepEqual(missing, [], 'Exported mutation actions absent from H7A T1 inventory')
})
