import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const entry = join(root, 'scripts', 'acceptance-dev-windows-ctrlc-probe.ts')
const nonce = 'b6f8188a8e81f031b5f87e12ad1b0c32'

function invoke(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', entry, ...args], {
    cwd: root,
    shell: false,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 5000,
    env: { NODE_ENV: 'test', PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
  })
}

test('KAN-885/T3 L6 --run fails closed on existing evidence without overwriting it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kan-885-run-preflight-'))
  const statePath = join(dir, 'existing.json')
  const original = 'preserve-existing-evidence'
  try {
    writeFileSync(statePath, original, { flag: 'wx' })
    const result = invoke(['--run', '--state', statePath, '--nonce', nonce])
    assert.equal(result.status, 2, result.stderr || result.error?.message || 'unexpected status')
    assert.match(result.stderr, /KAN-885.*(?:existing|exists|exclusive|occupied)/i)
    assert.equal(readFileSync(statePath, 'utf8'), original)
    assert.equal(result.stdout, '')
    assert.doesNotMatch(result.stderr, /existing\.json|preserve-existing-evidence/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('KAN-885/T3 L6 --run validates exact invocation before creating a disposable worker', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kan-885-run-invalid-'))
  const statePath = join(dir, 'never-created.json')
  try {
    for (const args of [
      ['--run', '--state', 'relative.json', '--nonce', nonce],
      ['--run', '--state', statePath, '--nonce', 'bad'],
      ['--run', '--state', statePath, '--nonce', nonce, '--verify'],
      ['--run', '--nonce', nonce, '--state', statePath],
    ]) {
      const result = invoke(args)
      assert.equal(result.status, 2, result.stderr || result.error?.message || 'unexpected status')
      assert.match(result.stderr, /KAN-885.*(?:invalid|arguments)/i)
      assert.equal(result.stdout, '')
      assert.doesNotMatch(result.stderr, /never-created\.json/)
    }
    assert.throws(() => readFileSync(statePath), { code: 'ENOENT' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
