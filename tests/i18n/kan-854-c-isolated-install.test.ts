import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

test('KAN-854/C installs unpatched Next 16.4.3 and eslint-config-next 16.4.3 in isolated temporary root', { timeout: 240_000 }, () => {
  const root = resolve('.')
  const existing = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>, devDependencies: Record<string, string>
  }
  assert.equal(existing.dependencies.next, '16.3.8', 'EXPERIMENT_INCONCLUSIVE: A baseline Next changed')
  assert.equal(existing.devDependencies['eslint-config-next'], '16.3.8', 'EXPERIMENT_INCONCLUSIVE: A baseline eslint config changed')
  const dir = mkdtempSync(join(tmpdir(), 'kan-854-c-install-'))
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'kan-854-c-disposable', private: true, version: '0.0.0',
      dependencies: {
        next: '16.4.3', 'eslint-config-next': '16.4.3',
        react: existing.dependencies.react, 'react-dom': existing.dependencies['react-dom'],
      },
    }, null, 2) + '\n')
    // Explicitly empty patch metadata; never inherit B or alter parent pnpm-workspace.yaml.
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - '.'\n")
    const args = ['install', '--ignore-scripts', '--no-frozen-lockfile', '--config.minimum-release-age=0']
    const install = spawnSync('pnpm', args, {
      cwd: dir, shell: process.platform === 'win32', windowsHide: true,
      encoding: 'utf8', timeout: 180_000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, CI: 'false' },
    })
    assert.equal(install.error, undefined, 'EXPERIMENT_SETUP_ERROR: isolated pnpm launch failed')
    assert.equal(install.status, 0, 'EXPERIMENT_SETUP_ERROR: isolated C install failed: ' + install.stdout + install.stderr)
    const nextPath = join(dir, 'node_modules', 'next')
    const eslintPath = join(dir, 'node_modules', 'eslint-config-next')
    const next = JSON.parse(readFileSync(join(nextPath, 'package.json'), 'utf8')) as {version:string}
    const eslint = JSON.parse(readFileSync(join(eslintPath, 'package.json'), 'utf8')) as {version:string}
    assert.equal(next.version, '16.4.3')
    assert.equal(eslint.version, '16.4.3')
    const router = join(nextPath, 'dist/server/lib/router-utils/resolve-routes.js')
    assert.ok(existsSync(router), 'EXPERIMENT_SETUP_ERROR: C router missing')
    const bytes = readFileSync(router)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const text = bytes.toString('utf8')
    assert.notEqual(hash, '53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3', 'EXPERIMENT_INCONCLUSIVE: C resolves historical B router artifact')
    assert.equal(existsSync(join(dir, 'patches')), false, 'EXPERIMENT_INCONCLUSIVE: C inherited historical patch directory')
    assert.ok(existsSync(join(nextPath, 'dist/bin/next')), 'EXPERIMENT_SETUP_ERROR: C executable absent')
    process.stdout.write('KAN-854 C_INSTALL_PROOF ' + JSON.stringify({
      nextVersion: next.version, eslintConfigNextVersion: eslint.version,
      routerSha256: hash, installMechanism: 'pnpm isolated install with no patchedDependencies',
      installationRoot: dir, historicalPatchMetadataPresent: false,
      nextBin: join(nextPath, 'dist/bin/next'),
    }) + '\n')
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 6, retryDelay: 400 })
  }
})
