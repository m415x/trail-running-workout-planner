import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const entry = resolve(root, 'scripts/acceptance-dev-windows-ctrlc-probe.ts')
const nonce = 'b6f8188a8e81f031b5f87e12ad1b0c32'

function invoke(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', entry, ...args], {
    cwd: root,
    shell: false,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, NODE_ENV: 'test' },
  })
}

function withRecord(action: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'kan-885-verify-'))
  const path = join(dir, 'probe.json')
  writeFileSync(path, JSON.stringify({
    version: 1,
    parentPid: process.pid,
    childPid: process.pid + 1,
    port: 54321,
    nonce,
  }), { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  try {
    action(path)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('KAN-885/T3 L6 --verify rejects a mismatched nonce before OS inspection', () => {
  withRecord(path => {
    const result = invoke(['--verify', '--state', path, '--nonce', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'])
    assert.equal(result.status, 2, result.stderr || result.error?.message || 'unexpected status')
    assert.match(result.stderr, /KAN-885.*nonce/i)
    assert.doesNotMatch(result.stderr, new RegExp(process.pid.toString() + '|probe\\.json'))
    assert.equal(result.stdout, '')
  })
})

test('KAN-885/T3 L6 --verify invokes live PID observation and fails closed without process mutation', () => {
  withRecord(path => {
    const result = invoke(['--verify', '--state', path, '--nonce', nonce])
    assert.equal(result.status, 2, result.stderr || result.error?.message || 'unexpected status')
    assert.match(result.stderr, /KAN-885.*(?:process|port).*verification failed/i)
    assert.doesNotMatch(result.stderr, /diagnostic mode is not enabled/i)
    assert.equal(result.stdout, '')
  })
})

test('KAN-885/T3 L6 --verify rejects incomplete or ambiguous input without revealing paths', () => {
  for (const args of [
    ['--verify', '--state', 'relative.json', '--nonce', nonce],
    ['--verify', '--state', resolve(root, 'missing-kan-885-probe-record.json'), '--nonce', nonce],
    ['--verify', '--state', resolve(root, 'anything'), '--nonce', 'invalid'],
    ['--verify', '--state', resolve(root, 'anything'), '--nonce', nonce, '--run'],
  ]) {
    const result = invoke(args)
    assert.equal(result.status, 2, result.stderr || result.error?.message || 'unexpected status')
    assert.match(result.stderr, /KAN-885/i)
    assert.equal(result.stdout, '')
    assert.doesNotMatch(result.stderr, /missing-kan-885-probe-record\.json|anything/)
  }
})
