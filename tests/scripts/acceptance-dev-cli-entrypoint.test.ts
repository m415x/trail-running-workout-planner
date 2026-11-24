import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '../..')

test('KAN-885/T3 exposes pn acceptance:dev with a local launcher and safe help entrypoint', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  assert.equal(pkg.scripts?.['acceptance:dev'], 'tsx scripts/acceptance-dev.ts')

  const launcher = resolve(root, 'scripts/acceptance-dev.ts')
  assert.equal(existsSync(launcher), true, 'acceptance launcher entrypoint must exist')

  const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const help = spawnSync(process.execPath, [tsxCli, launcher, '--help'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      SQLITE_SEED_DISPOSABLE_ACK: '1',
    },
  })
  assert.equal(help.error, undefined)
  assert.equal(help.status, 0, 'help must not start Next.js or access SQLite')
  assert.match(help.stdout, /pn acceptance:dev --db/i)
  assert.doesNotMatch(help.stdout + help.stderr, /SQLITE_SEED_DISPOSABLE_ACK=1/)
})
