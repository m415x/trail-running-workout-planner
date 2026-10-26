import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import test from 'node:test'

const root = resolve('.')
const allowed = ['app/', 'components/', 'hooks/', 'i18n/', 'lib/', 'db/', 'public/', 'messages/', 'types/', 'utils/']
const rootFiles = new Set(['next.config.ts', 'proxy.ts', 'package.json', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs', 'components.json', 'tailwind.config.ts'])

function isApplicationSource(path: string): boolean {
  return allowed.some(prefix => path.startsWith(prefix)) || rootFiles.has(path)
}

function trackedSources(): string[] {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer', windowsHide: true })
  assert.equal(result.status, 0, 'Cannot enumerate committed source tree')
  return (result.stdout as Buffer).toString('utf8').split('\0').filter(isApplicationSource).sort()
}

function fingerprint(paths: string[]): string {
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(path)
    hash.update(readFileSync(resolve(root, path)))
  }
  return hash.digest('hex')
}

test('KAN-854/T1 prepares a tracked-source-only disposable real-app snapshot without touching original state', () => {
  const files = trackedSources()
  for (const required of ['next.config.ts', 'proxy.ts', 'i18n/routing.ts', 'i18n/request.ts', 'package.json']) {
    assert.ok(files.includes(required), 'Missing authentic application file ' + required)
  }
  assert.ok(files.some(path => path.startsWith('app/[locale]/')), 'Missing localized Next application routes')
  assert.ok(!files.some(path => /(?:^|\/)(?:node_modules|\.next|\.tmp|sqlite\.db)(?:\/|$)/.test(path)))
  const original = fingerprint(files)
  const tempParent = resolve('.tmp')
  mkdirSync(tempParent, { recursive: true })
  const temporary = mkdtempSync(join(tempParent, 'kan-854-real-app-source-'))
  try {
    for (const file of files) {
      const dest = resolve(temporary, file)
      assert.ok(relative(temporary, dest) !== '..' && !relative(temporary, dest).startsWith('..' + sep), 'escaped disposable root')
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(resolve(root, file), dest)
    }
    assert.equal(readFileSync(join(temporary, 'i18n/routing.ts'), 'utf8'), readFileSync('i18n/routing.ts', 'utf8'))
    assert.equal(readFileSync(join(temporary, 'proxy.ts'), 'utf8'), readFileSync('proxy.ts', 'utf8'))
    assert.ok(!existsSync(join(temporary, '.env.local')))
    assert.ok(!existsSync(join(temporary, 'sqlite.db')))
    assert.ok(!existsSync(join(temporary, 'node_modules')))
    assert.ok(!existsSync(join(temporary, '.next')))
    assert.equal(fingerprint(files), original, 'Application source changed while preparing fixture')
  } finally {
    rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
})
