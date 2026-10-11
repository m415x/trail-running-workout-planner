import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? files(path) : path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

test('KAN-726 records whether identity mutation helpers have actual production callers', () => {
  const doc = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  for (const operation of ['revokeTeamMembership', 'associateAuthorizedExternalIdentity']) {
    const callers = [...files('app'), ...files('lib')].filter((path) => {
      const source = readFileSync(path, 'utf8')
      return source.includes(operation + '(') && !source.includes('export function ' + operation)
    })
    assert.ok(doc.includes('Production caller evidence for ' + operation + ': ' + (callers.length ? callers.sort().join(', ') : 'none found')), 'Missing live caller evidence: ' + operation)
  }
})
