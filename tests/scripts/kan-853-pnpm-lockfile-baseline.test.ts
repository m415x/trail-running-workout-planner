import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
  packageManager: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}
const lock = readFileSync('pnpm-lock.yaml', 'utf8')
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8')

function secondDocument(): string {
  const documents = lock.split(/^---\\s*$/m).filter((part) => part.trim())
  assert.equal(documents.length, 2, 'pnpm 12 lockfile must retain manager and app YAML documents')
  assert.match(documents[0], /^\\s*packageManagerDependencies:/m)
  assert.match(documents[0], /pnpm:\\s*\\n\\s+specifier: 12\\.4\\.1/)
  return documents[1]
}

function importerSection(doc: string): string {
  const match = doc.match(/^importers:\\s*\\n\\s*\\n\\s{2}\\.:\\s*\\n([\\s\\S]*?)(?=^packages:|^snapshots:|\\$(?!))/m)
  assert.ok(match, 'second document must contain root application importer')
  return match[1]
}

test('KAN-853 S1: pnpm dual-document lockfile carries the application importer', () => {
  assert.equal(manifest.packageManager, 'pnpm@12.4.1')
  assert.match(workspace, /^packages:\\s*\\n\\s+- '\\.'$/m)
  const doc = secondDocument()
  assert.match(doc, /^lockfileVersion: '9\\.0'$/m)
  const importer = importerSection(doc)
  assert.match(importer, /^\\s{4}dependencies:/m)
  assert.match(importer, /^\\s{4}devDependencies:/m)
})

test('KAN-853 S1: resolved application importer covers every declared direct dependency', () => {
  const importer = importerSection(secondDocument())
  for (const [kind, entries] of Object.entries({
    dependencies: manifest.dependencies,
    devDependencies: manifest.devDependencies,
  })) {
    const start = importer.indexOf('    ' + kind + ':\\n')
    assert.notEqual(start, -1, kind + ' section missing')
    const tail = importer.slice(start + 5 + kind.length)
    const next = tail.search(/^    [a-zA-Z]/m)
    const section = next < 0 ? tail : tail.slice(0, next)
    for (const [name, specifier] of Object.entries(entries)) {
      const key = '      ' + (name.startsWith('@') ? "'" + name + "'" : name) + ':'
      assert.ok(section.includes(key + '\\n'), kind + ' missing ' + name)
      const entry = section.slice(section.indexOf(key + '\\n') + key.length)
      const spec = entry.match(/^\\s*specifier: (.+)$/m)
      assert.ok(spec, name + ' missing specifier')
      assert.equal(spec[1].replace(/^['\"]|['\"]$/g, ''), specifier, name + ' specifier drift')
      assert.match(entry, /^\\s*version: /m, name + ' missing resolved version')
    }
  }
})
