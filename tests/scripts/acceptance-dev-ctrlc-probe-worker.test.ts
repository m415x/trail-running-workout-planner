import assert from 'node:assert/strict'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { parseAcceptanceDevCtrlcProbeState } from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'

const root = resolve(import.meta.dirname, '../..')
const entry = join(root, 'scripts', 'acceptance-dev-windows-ctrlc-probe-worker.ts')
const nonce = 'f6f8188a8e81f031b5f87e12ad1b0c32'

function start(args: string[]): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, ['--import', 'tsx', entry, ...args], {
    cwd: root,
    shell: false,
    windowsHide: true,
    env: { NODE_ENV: 'test', PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
  })
}

async function until<T>(read: () => Promise<T | undefined>, durationMs = 5000): Promise<T> {
  const deadline = Date.now() + durationMs
  while (Date.now() < deadline) {
    const result = await read()
    if (result !== undefined) return result
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('KAN-885: disposable worker did not become ready')
}

async function canConnect(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = connect({ host: '127.0.0.1', port })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => { socket.destroy(); resolve(false) })
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false) })
  })
}

test('KAN-885/T3 L6 isolated worker records own PID and binds only disposable loopback', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kan-885-worker-'))
  const path = join(dir, 'worker-state.json')
  const child = start(['--state', path, '--nonce', nonce])
  try {
    const record = await until(async () => {
      if (child.exitCode !== null) throw new Error('KAN-885: worker exited before readiness')
      try {
        return parseAcceptanceDevCtrlcProbeState(await readFile(path, 'utf8'))
      } catch {
        return undefined
      }
    })
    assert.equal(record.parentPid, process.pid)
    assert.equal(record.childPid, child.pid)
    assert.equal(record.nonce, nonce)
    assert.equal(await canConnect(record.port), true)
  } finally {
    if (child.exitCode === null && child.pid) child.kill('SIGTERM')
    await Promise.race([
      new Promise<void>(resolve => child.once('exit', () => resolve())),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('KAN-885: worker cleanup timed out')), 5000)),
    ]).catch(error => { if (child.exitCode === null && child.pid) child.kill(); throw error })
    await rm(dir, { recursive: true, force: true })
  }
})

test('KAN-885/T3 L6 worker rejects malformed invocation without writing a record', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kan-885-worker-invalid-'))
  const path = join(dir, 'not-created.json')
  const child = start(['--state', path, '--nonce', 'bad'])
  try {
    const code = await Promise.race([
      new Promise<number | null>(resolve => child.once('exit', code => resolve(code))),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('KAN-885: invalid worker args hung')), 5000)),
    ])
    assert.equal(code, 2)
    await assert.rejects(readFile(path, 'utf8'), { code: 'ENOENT' })
  } finally {
    if (child.exitCode === null && child.pid) child.kill()
    await rm(dir, { recursive: true, force: true })
  }
})
