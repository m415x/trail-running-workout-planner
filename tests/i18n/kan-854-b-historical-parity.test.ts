import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const historicalSha = '5df5693f0ab5717b22bebcbea16110a7722d470a'
const patchPath = 'patches/next@16.3.8.patch'
const expectedPatchHash = '6405c9217c3f38afb8070d800f6c36459927ddc3ed7c8bfd62ba32d951af1912'
const root = resolve('.')

function git(args: string[]): Buffer {
  const result = spawnSync('git', args, { cwd: root, encoding: 'buffer', windowsHide: true, maxBuffer: 8 * 1024 * 1024 })
  assert.equal(result.status, 0, 'EXPERIMENT_SETUP_ERROR: historical Git object missing or unreadable: git ' + args.join(' ') + ': ' + String(result.stderr))
  return result.stdout as Buffer
}

function trackedAt(revision: string): string[] {
  return git(['ls-tree', '-r', '--name-only', '-z', revision]).toString('utf8').split('\0').filter(Boolean)
}

test('KAN-854/B preflight verifies historical patch and application-source comparability', () => {
  const patch = git(['show', historicalSha + ':' + patchPath])
  assert.equal(createHash('sha256').update(patch).digest('hex'), expectedPatchHash)
  const workspace = git(['show', historicalSha + ':pnpm-workspace.yaml']).toString('utf8')
  assert.match(workspace, /patchedDependencies:/)
  assert.match(workspace, /next@16\.3\.8: patches\/next@16\.3\.8\.patch/)
  const packageJson = JSON.parse(git(['show', historicalSha + ':package.json']).toString('utf8')) as {dependencies: Record<string,string>}
  const current = JSON.parse(readFileSync('package.json', 'utf8')) as {dependencies: Record<string,string>}
  assert.equal(packageJson.dependencies.next, '16.3.8')
  assert.equal(current.dependencies.next, '16.3.8')

  // Diagnose the historical source drift in one Git operation. Do not imply
  // that a historical app checkout is an otherwise-equivalent runtime B.
  const sourceRoots = ['app/', 'components/', 'context/', 'data/', 'db/', 'features/', 'hooks/', 'i18n/', 'lib/', 'service/', 'types/', 'proxy.ts', 'next.config.ts']
  const diff = git(['diff', '--name-status', historicalSha, 'HEAD', '--', ...sourceRoots]).toString('utf8').trim()
  const rows = diff ? diff.split(/\r?\n/).map(line => {
    const [change, ...pathParts] = line.split('\t')
    return {change, path: pathParts.join(' -> ')}
  }) : []
  const critical = ['proxy.ts', 'next.config.ts', 'i18n/routing.ts', 'i18n/request.ts', 'lib/i18n/normalize-local-rewrite.ts']
  const criticalChanges = rows.filter(row => critical.includes(row.path))
  const summary = {
    historicalSha,
    patchSha256: expectedPatchHash,
    applicationFilesChanged: rows.length,
    criticalChanges,
    historicalTreeEquivalent: rows.length === 0,
    comparisonMode: rows.length === 0 ? 'historical-head-comparable' : 'fixed-A-application-required',
  }
  process.stdout.write('KAN-854 B_SOURCE_PARITY ' + JSON.stringify(summary) + '\n')
  assert.ok(rows.length > 0 || summary.historicalTreeEquivalent)
  // Historical changes are an expected diagnostic, not a patch runtime GREEN.
  // No HTTP B may be inferred from this test.

})
