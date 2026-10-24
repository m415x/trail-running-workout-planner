import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'

const root = resolve('.')
const require = createRequire(import.meta.url)
const historicalSha = '5df5693f0ab5717b22bebcbea16110a7722d470a'
const patchHash = '6405c9217c3f38afb8070d800f6c36459927ddc3ed7c8bfd62ba32d951af1912'
const patchedRouterHash = '53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3'
const routerPath = 'dist/server/lib/router-utils/resolve-routes.js'

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

test('KAN-854/B provisions isolated executable Next package with historical router patch', () => {
  const version = (require('next/package.json') as {version:string}).version
  assert.equal(version, '16.3.8', 'EXPERIMENT_INCONCLUSIVE: B requires Next 16.3.8')
  const installedRouter = require.resolve('next/dist/server/lib/router-utils/resolve-routes.js')
  const original = readFileSync(installedRouter)
  const historical = spawnSync('git', ['show', historicalSha + ':patches/next@16.3.8.patch'], {
    cwd: root, encoding: 'buffer', windowsHide: true,
  })
  assert.equal(historical.status, 0, 'EXPERIMENT_SETUP_ERROR: missing historical patch object')
  const patch = historical.stdout as Buffer
  assert.equal(sha256(patch), patchHash, 'B patch identity mismatch')
  const dir = mkdtempSync(join(tmpdir(), 'kan-854-b-router-'))
  try {
    const runtimeRoot = join(dir, 'node_modules', 'next')
    cpSync(dirname(require.resolve('next/package.json')), runtimeRoot, { recursive: true })
    const target = join(runtimeRoot, routerPath)
    assert.equal(sha256(readFileSync(target)), sha256(original), 'EXPERIMENT_INCONCLUSIVE: isolated package source is not equivalent to A')
    const patchFile = join(dir, 'historical.patch')
    writeFileSync(patchFile, patch)
    const check = spawnSync('git', ['apply', '--check', patchFile], { cwd: dir, encoding: 'utf8', windowsHide: true })
    assert.equal(check.status, 0, 'EXPERIMENT_INCONCLUSIVE: historical patch cannot apply to A installed router: ' + check.stderr)
    const apply = spawnSync('git', ['apply', patchFile], { cwd: dir, encoding: 'utf8', windowsHide: true })
    assert.equal(apply.status, 0, 'EXPERIMENT_SETUP_ERROR: disposable historical patch apply failed: ' + apply.stderr)
    const patchedBytes = readFileSync(target)
    const actual = sha256(patchedBytes)
    const normalizedHash = sha256(Buffer.from(patchedBytes.toString('utf8').replace(/\r\n/g, '\n')))
    const originalNormalizedHash = sha256(Buffer.from(original.toString('utf8').replace(/\r\n/g, '\n')))
    const lineEndings = { originalCrLf: (original.toString('utf8').match(/\r\n/g) ?? []).length, patchedCrLf: (patchedBytes.toString('utf8').match(/\r\n/g) ?? []).length }
    process.stdout.write('KAN-854 B_ROUTER_PROOF ' + JSON.stringify({ version, historicalSha, patchHash, unpatchedRouterHash: sha256(original), patchedRouterHash: actual, patchedNormalizedHash: normalizedHash, originalNormalizedHash, lineEndings, isolation: 'disposable-copy' }) + '\n')
    assert.ok(actual === patchedRouterHash || normalizedHash === patchedRouterHash, 'EXPERIMENT_INCONCLUSIVE: patched router differs from historical B artifact even after LF normalization')
    assert.equal(sha256(readFileSync(installedRouter)), sha256(original), 'Installed A router unexpectedly changed')
    const isolatedRequire = createRequire(join(dir, 'runtime-entry.cjs'))
    const resolvedNext = isolatedRequire.resolve('next/package.json')
    const resolvedRouter = isolatedRequire.resolve('next/dist/server/lib/router-utils/resolve-routes.js')
    const result = spawnSync(process.execPath, ['-e', `const r=require('node:module').createRequire(process.argv[1]); const path=r.resolve('next/dist/server/lib/router-utils/resolve-routes.js'); const fs=require('node:fs'); const crypto=require('node:crypto'); process.stdout.write(JSON.stringify({resolved:path, sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')}))`, join(dir, 'runtime-entry.cjs')], { cwd: dir, encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, 'EXPERIMENT_SETUP_ERROR: isolated Node resolution failed: ' + result.stderr)
    const proof = JSON.parse(result.stdout) as { resolved: string; sha256: string }
    assert.equal(resolve(proof.resolved), resolve(target), 'EXPERIMENT_INCONCLUSIVE: Node resolved A router instead of B')
    assert.equal(proof.sha256, actual)
    assert.equal(resolve(resolvedRouter), resolve(target))
    assert.ok(resolve(resolvedNext).startsWith(resolve(runtimeRoot)))
    process.stdout.write('KAN-854 B_EXECUTABLE_RUNTIME ' + JSON.stringify({ version, historicalSha, patchHash, routerRawSha256: actual, routerNormalizedSha256: normalizedHash, nodeResolvedPath: proof.resolved, packageResolution: resolvedNext, runtime: 'disposable-package-copy', loadedBySeparateNode: true }) + '\\n')
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
})
