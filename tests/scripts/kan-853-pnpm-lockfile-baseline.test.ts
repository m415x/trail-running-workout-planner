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
  const importer = application.split(/^importers:\s*$/m)[1]?.split(/^packages:\s*$/m)[0]
  assert.ok(importer, 'application importer missing')
  for (const [sectionName, entries] of Object.entries({
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
  })) {
    const section = importer.split(new RegExp('^    ' + sectionName + ':\\s*$', 'm'))[1]
      ?.split(/^    (?:dependencies|devDependencies|optionalDependencies):/m)[0]
    assert.ok(section, sectionName + ' section missing')
    for (const [name, specifier] of Object.entries(entries)) {
      const key = name.startsWith('@') ? "'" + name + "'" : name
      const stanza = section.split('      ' + key + ':\n')[1]?.split(/^      (?:'[^']+'|[^:\n]+):/m)[0]
      assert.ok(stanza, 'missing importer dependency ' + name)
      assert.ok(stanza.includes('        specifier: ' + specifier + '\n')
        || stanza.includes("        specifier: '" + specifier + "'\n"),
        name + ' specifier disagrees with package.json')
      assert.match(stanza, /^\s+version: /m, name + ' resolved version missing')
    }
  }
})
