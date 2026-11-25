import assert from 'node:assert/strict'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  buildAcceptanceDevCtrlcProbeRunPlan,
  parseAcceptanceDevCtrlcProbeState,
} from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'
import {
  isAcceptanceDevCtrlcProbePidAlive,
  isAcceptanceDevCtrlcProbePortAvailable,
} from '@/scripts/acceptance-dev-windows-ctrlc-probe-os'
import * as probe from '@/scripts/acceptance-dev-windows-ctrlc-probe-run'

const root = resolve(import.meta.dirname, '../..')
const nonce = 'adf8188a8e81f031b5f87e12ad1b0c32'
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function waitFor<T>(observe: () => Promise<T | undefined>, description: string): Promise<T> {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    const value = await observe()
    if (value !== undefined) return value
    await sleep(50)
  }
  throw new Error('KAN-885: timed out awaiting disposable ' + description)
}

test('KAN-885/T3 L6 real Windows worker releases its exact PID and port after owned SIGINT', {
  skip: process.platform !== 'win32' ? 'requires Windows process-tree termination' : false,
  timeout: 25000,
}, async () => {
  const base = join(root, '.tmp')
  await mkdir(base, { recursive: true })
  const dir = await mkdtemp(join(base, 'kan-885-real-worker-'))
  const statePath = join(dir, 'evidence.json')
  const signals = new EventEmitter()
  const workerPlan = buildAcceptanceDevCtrlcProbeRunPlan({
    projectRoot: root,
    statePath,
    nonce,
    inheritedEnv: { NODE_ENV: 'test', PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
  })
  let ownedChild: ChildProcess | undefined
  let released = false
  let run: Promise<number> | undefined

  try {
    const candidate = (probe as unknown as Record<string, unknown>)
      .runAcceptanceDevCtrlcProbeWindowsRealWorker
    assert.equal(typeof candidate, 'function', 'real owned Windows worker adapter must exist')
    const start = candidate as (input: {
      plan: typeof workerPlan
      signalSource: EventEmitter
      spawnProcess: typeof spawn
    }) => Promise<number>

    run = start({
      plan: workerPlan,
      signalSource: signals,
      spawnProcess: (command, args, options) => {
        const child = spawn(command, args, options)
        if (command === process.execPath) ownedChild = child
        return child
      },
    })
    // Avoid an unhandled rejection if startup fails before the record exists.
    void run.catch(() => {})
    const record = await waitFor(async () => {
      try { return parseAcceptanceDevCtrlcProbeState(await readFile(statePath, 'utf8')) }
      catch { return undefined }
    }, 'worker startup')
    assert.equal(record.parentPid, process.pid)
    assert.equal(record.childPid, ownedChild?.pid)
    assert.equal(record.nonce, nonce)
    assert.equal(await isAcceptanceDevCtrlcProbePortAvailable(record.port), false)

    signals.emit('SIGINT')
    await assert.rejects(run, /KAN-885.*(?:interrupt|terminat)/i)

    await waitFor(async () => {
      if (isAcceptanceDevCtrlcProbePidAlive(record.childPid)) return undefined
      if (!await isAcceptanceDevCtrlcProbePortAvailable(record.port)) return undefined
      return true
    }, 'worker PID and loopback release')

    assert.equal(signals.listenerCount('SIGINT'), 0)
    assert.equal(signals.listenerCount('SIGTERM'), 0)
    released = true
  } finally {
    // Emergency cleanup is restricted to the process handle actually spawned
    // by this test; never kill unrelated processes or sweep all Node PIDs.
    if (!released && ownedChild?.pid && ownedChild.exitCode === null) {
      spawnSync('taskkill.exe', ['/PID', String(ownedChild.pid), '/T', '/F'], {
        shell: false, windowsHide: true, stdio: 'ignore', timeout: 4000,
      })
    }
    if (run) void run.catch(() => {})
    await rm(dir, { recursive: true, force: true })
  }
})
