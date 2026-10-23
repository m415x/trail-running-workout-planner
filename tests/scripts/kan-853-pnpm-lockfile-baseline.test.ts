import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  packageManager: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8').replace(/\r\n/g, '\n')
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8').replace(/\r\n/g, '\n')

function getApplicationDocument(): string {
  const documents = lockfile.split(/^---\s*$/m).filter((doc) => doc.trim().length > 0)
  assert.equal(documents.length, 2, 'pnpm 12 must retain manager and application YAML documents')
  assert.match(documents[0], /^\s*packageManagerDependencies:/m)
  assert.match(documents[0], /pnpm:\s*\n\s+specifier: 12\.4\.1/)
  assert.match(documents[1], /^importers:/m)
  assert.match(documents[1], /^packages:/m)
  assert.match(documents[1], /^snapshots:/m)
  return documents[1]
}

test('KAN-853/S1 dual-document pnpm lockfile and workspace are present', () => {
  assert.equal(packageJson.packageManager, 'pnpm@12.4.1')
  assert.match(workspace, /^packages:\s*\n\s+- '\.'$/m)
  assert.match(getApplicationDocument(), /^lockfileVersion: '9\.0'$/m)
})

test('KAN-853/S1 resolved root importer covers all direct application dependencies', () => {
  const application = getApplicationDocument()
  const lines = application.split('\n')
  const resolved = new Map<string, Map<string, { specifier?: string; version?: string }>>()
  let insideImporter = false
  let insideRoot = false
  let section: string | undefined
  let dependency: string | undefined

  for (const line of lines) {
    if (line === 'importers:') {
      insideImporter = true
      continue
    }
    if (!insideImporter) continue
    if (line === 'packages:') break
    if (/^  [^ ]/.test(line)) {
      insideRoot = line === '  .:'
      section = undefined
      dependency = undefined
      continue
    }
    if (!insideRoot) continue
    const sectionMatch = line.match(/^    (dependencies|devDependencies):$/)
    if (sectionMatch) {
      section = sectionMatch[1]
      resolved.set(section, new Map())
      dependency = undefined
      continue
    }
    const dependencyMatch = line.match(/^      (.+):$/)
    if (dependencyMatch && section) {
      dependency = dependencyMatch[1].replace(/^['"]|['"]$/g, '')
      resolved.get(section)?.set(dependency, {})
      continue
    }
    const valueMatch = line.match(/^        (specifier|version): (.+)$/)
    if (valueMatch && section && dependency) {
      const entry = resolved.get(section)?.get(dependency)
      if (entry) entry[valueMatch[1] as 'specifier' | 'version'] = valueMatch[2].replace(/^['"]|['"]$/g, '')
    }
  }

  for (const [kind, dependencies] of Object.entries({
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
  })) {
    const sectionEntries = resolved.get(kind)
    assert.ok(sectionEntries, kind + ' section missing')
    for (const [name, specifier] of Object.entries(dependencies)) {
      const entry = sectionEntries.get(name)
      assert.ok(entry, 'missing importer dependency ' + name)
      assert.equal(entry.specifier, specifier, name + ' specifier drift')
      assert.ok(entry.version, name + ' missing resolved version')
    }
  }
})
