import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// KAN-856/T2: bounded, non-exhaustion regression for the approved direct dependency.
// pnpm 12.4.1 has two YAML documents; the second owns the application resolution.
const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>
}
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8').replace(/\r\n/g, '\n')
const documents = lockfile.split(/^---\s*$/m).filter(document => document.trim().length > 0)

test('KAN-856/T2 direct Zod resolves to the approved 4.6.7 in manifest and pnpm lockfile', () => {
  assert.equal(documents.length, 2, 'pnpm 12 lockfile must retain two documents')
  const application = documents[1]
  assert.match(application, /^lockfileVersion: '9\.0'$/m)
  // Whitespace between YAML sections is allowed; anchor sections, not adjacency.
  const importerMatch = application.match(/^importers:\s*\n\s*  \.:\s*\n([\s\S]*?)(?=^packages:)/m)
  assert.ok(importerMatch, 'root importer missing')
  const dependencyMatch = importerMatch[1].match(/^    dependencies:\s*\n([\s\S]*?)(?=^    devDependencies:|^  [^ ]|$)/m)
  assert.ok(dependencyMatch, 'root production dependencies missing')
  const zodMatch = dependencyMatch[1].match(/^      zod:\n        specifier: (.+)\n        version: (.+)$/m)
  assert.ok(zodMatch, 'root Zod dependency resolution missing')

  assert.equal(manifest.dependencies.zod, '4.6.7', 'approved direct Zod version required')
  assert.equal(zodMatch[1], manifest.dependencies.zod, 'manifest/importer specifier drift')
  assert.equal(zodMatch[2], '4.6.7', 'root importer must resolve safe Zod version')
  assert.match(application, /^  zod@4\.6\.7:\s*\n    resolution:/m, 'resolved package missing')
  assert.match(application, /^  zod@4\.6\.7: \{\}$/m, 'resolved snapshot missing')
})
