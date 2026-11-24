import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runAcceptanceDevWindowsOwnedProcess } from '@/scripts/acceptance-dev-child-env'

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function awaitMarker(path: string): Promise<{ parentPid: number; childPid: number; port: number }> {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try {
      const content = JSON.parse(await readFile(path, 'utf8')) as {
        parentPid: number; childPid: number; port: number
      }
      if (content.parentPid > 0 && content.childPid > 0 && content.port > 0) return content
    } catch {
      // A marker is only written after the test descendant owns a loopback socket.
    }
    await delay(40)
  }
  throw new Error('KAN-885 test fixture did not become ready')
}

async function canBind(port: number): Promise<boolean> {
  const server = createServer()
  return await new Promise<boolean>(resolve => {
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

function stopTestOwnedPid(pid: number | undefined): void {
  if (process.platform !== 'win32' || !pid || pid === process.pid) return
  // Emergency cleanup, restricted to PIDs written by our disposable workers.
  spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    shell: false, windowsHide: true, stdio: 'ignore', timeout: 4000,
  })
}

test('KAN-885/T3 L6 Windows Ctrl+C releases descendant-owned port without orphan', {
  skip: process.platform !== 'win32' ? 'requires native Windows taskkill' : false,
  timeout: 20000,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kan-885-l6-'))
  const markerFile = join(dir, 'owned-socket.json')
  const parentFile = join(dir, 'owned-parent.json')
  const signals = new EventEmitter()
  let marker: { parentPid: number; childPid: number; port: number } | undefined
  let fixtureFinished = false

  const grandchild = [
    "const net = require('node:net')",
    "const fs = require('node:fs')",
    "const server = net.createServer()",
    "server.listen(0, '127.0.0.1', () => {",
    " const data = { parentPid: process.ppid, childPid: process.pid, port: server.address().port }",
    " fs.writeFileSync(process.argv[1], JSON.stringify(data))",
    "})",
  ].join('\n')
  const parent = [
    "const { spawn } = require('node:child_process')",
    "require('node:fs').writeFileSync(process.argv[2], JSON.stringify({ parentPid: process.pid }))",
    "spawn(process.execPath, ['-e', process.argv[3], process.argv[1]], { stdio: 'ignore', windowsHide: true })",
    "setInterval(() => {}, 1000)",
  ].join(';')

  let run: Promise<number> | undefined
  try {
    run = runAcceptanceDevWindowsOwnedProcess({
      plan: {
        command: process.execPath,
        args: ['-e', parent, markerFile, parentFile, grandchild],
        cwd: process.cwd(),
        env: { NODE_ENV: 'test', PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
      },
      signalSource: signals,
      terminationTimeoutMs: 7000,
    })
    marker = await awaitMarker(markerFile)
    assert.notEqual(marker.parentPid, process.pid)
    assert.notEqual(marker.childPid, process.pid)
    assert.equal(await canBind(marker.port), false, 'descendant must own the port before SIGINT')
    signals.emit('SIGINT')
    await assert.rejects(run, /KAN-885.*(?:signal|interrupt|terminat)/i)

    const deadline = Date.now() + 5000
    let released = false
    while (Date.now() < deadline) {
      if (await canBind(marker.port)) {
        released = true
        break
      }
      await delay(50)
    }
    assert.equal(released, true, 'Ctrl+C must release the descendant loopback port')
    assert.equal(signals.listenerCount('SIGINT'), 0)
    assert.equal(signals.listenerCount('SIGTERM'), 0)
    fixtureFinished = true
  } finally {
    // Never allow a failed acceptance assertion to leave test workers alive.
    try {
      marker ??= JSON.parse(await readFile(markerFile, 'utf8')) as typeof marker
    } catch { /* marker may never have been created */ }
    let parentPid: number | undefined = marker?.parentPid
    try {
      parentPid ??= (JSON.parse(await readFile(parentFile, 'utf8')) as { parentPid: number }).parentPid
    } catch { /* parent may never have started */ }
    // Skip cleanup after a verified release to minimize PID-reuse risk.
    if (!fixtureFinished) {
      stopTestOwnedPid(parentPid)
      stopTestOwnedPid(marker?.childPid)
    }
    if (run) void run.catch(() => {})
    await rm(dir, { recursive: true, force: true })
  }
})
