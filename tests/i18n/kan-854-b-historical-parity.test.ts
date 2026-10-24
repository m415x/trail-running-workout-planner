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
  const excluded = /^(?:tests\/|docs\/|scripts\/|patches\/|\.github\/|drizzle\/|\.tmp\/|\.next\/|node_modules\/|\.env(?:\.|$)|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|.*\.(?:db|sqlite|zip|log)$)/
  const historicalFiles = trackedAt(historicalSha).filter(path => !excluded.test(path))
  const currentFiles = git(['ls-files', '-z']).toString('utf8').split('\0').filter(path => path && !excluded.test(path))
  const historicalSet = new Set(historicalFiles)
  const currentSet = new Set(currentFiles)
  const onlyHistorical = historicalFiles.filter(path => !currentSet.has(path))
  const onlyCurrent = currentFiles.filter(path => !historicalSet.has(path))
  const different = historicalFiles.filter(path => currentSet.has(path) && !git(['show', historicalSha + ':' + path]).equals(readFileSync(path)))
  const summary = {historicalSha, patchSha256: expectedPatchHash, onlyHistorical, onlyCurrent, different}
  process.stdout.write('KAN-854 B_SOURCE_PARITY ' + JSON.stringify(summary) + '\n')
  assert.deepEqual(onlyHistorical, [], 'EXPERIMENT_INCONCLUSIVE: B source files absent from A; reconcile before HTTP')
  assert.deepEqual(onlyCurrent, [], 'EXPERIMENT_INCONCLUSIVE: A source files absent from B; reconcile before HTTP')
  assert.deepEqual(different, [], 'EXPERIMENT_INCONCLUSIVE: application source drift between B and A; reconcile before HTTP')
})
