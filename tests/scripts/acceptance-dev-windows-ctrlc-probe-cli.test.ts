import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const entry = resolve(root, 'scripts/acceptance-dev-windows-ctrlc-probe.ts')

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

test('KAN-885/T3 L6 standalone Windows Ctrl+C probe documents explicit manual run/verify workflow', () => {
  const result = invoke(['--help'])
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'KAN-885: unexpected probe exit status')
  assert.match(result.stdout, /KAN-885.*Ctrl\+C/i)
  assert.match(result.stdout, /--run/)
  assert.match(result.stdout, /--verify/)
  assert.match(result.stdout, /Git Bash/i)
  assert.doesNotMatch(result.stderr, /sqlite|supabase|next dev/i)
})

test('KAN-885/T3 L6 probe rejects an unqualified invocation without spawning a process tree', () => {
  const result = invoke([])
  assert.equal(result.status, 2, result.stderr || result.error?.message || 'KAN-885: unexpected probe exit status')
  assert.match(result.stderr, /KAN-885.*(?:usage|explicit|mode)/i)
  assert.doesNotMatch(result.stdout, /ready|listening|port/i)
})

test('KAN-885/T3 L6 probe refuses unsupported mode and never launches Next', () => {
  const result = invoke(['--run', '--verify'])
  assert.equal(result.status, 2, result.stderr || result.error?.message || 'KAN-885: unexpected probe exit status')
  assert.match(result.stderr, /KAN-885/i)
  assert.doesNotMatch(result.stdout, /ready|listening|port/i)
})
