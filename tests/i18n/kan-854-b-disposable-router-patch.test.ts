import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

test('KAN-854/B applies authentic historical router patch only to a disposable copy', () => {
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
    const target = join(dir, routerPath)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(installedRouter, target)
    const patchFile = join(dir, 'historical.patch')
    writeFileSync(patchFile, patch)
    const check = spawnSync('git', ['apply', '--check', patchFile], { cwd: dir, encoding: 'utf8', windowsHide: true })
    assert.equal(check.status, 0, 'EXPERIMENT_INCONCLUSIVE: historical patch cannot apply to A installed router: ' + check.stderr)
    const apply = spawnSync('git', ['apply', patchFile], { cwd: dir, encoding: 'utf8', windowsHide: true })
    assert.equal(apply.status, 0, 'EXPERIMENT_SETUP_ERROR: disposable historical patch apply failed: ' + apply.stderr)
    const actual = sha256(readFileSync(target))
    process.stdout.write('KAN-854 B_ROUTER_PROOF ' + JSON.stringify({ version, historicalSha, patchHash, unpatchedRouterHash: sha256(original), patchedRouterHash: actual, isolation: 'disposable-copy' }) + '\n')
    assert.equal(actual, patchedRouterHash, 'EXPERIMENT_INCONCLUSIVE: patched router differs from historical B artifact')
    assert.equal(sha256(readFileSync(installedRouter)), sha256(original), 'Installed A router unexpectedly changed')
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
})
