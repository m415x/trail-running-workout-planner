import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import test from 'node:test'

import * as probes from '@/scripts/acceptance-dev-windows-ctrlc-probe-os'

type IsPidAlive = (pid: number) => boolean
type IsPortAvailable = (port: number) => Promise<boolean>

test('KAN-885/T3 L6 read-only PID probe observes current process without terminating it', () => {
  const candidate = (probes as unknown as Record<string, unknown>)
    .isAcceptanceDevCtrlcProbePidAlive
  assert.equal(typeof candidate, 'function', 'read-only OS PID probe must exist')
  const isPidAlive = candidate as IsPidAlive
  assert.equal(isPidAlive(process.pid), true, 'current test runner must remain alive')
  for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => isPidAlive(invalid), /KAN-885/i)
  }
})

test('KAN-885/T3 L6 read-only loopback probe detects owned port occupied and then released', async () => {
  const candidate = (probes as unknown as Record<string, unknown>)
    .isAcceptanceDevCtrlcProbePortAvailable
  assert.equal(typeof candidate, 'function', 'loopback-only TCP probe must exist')
  const isPortAvailable = candidate as IsPortAvailable
  const server = createServer()
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    assert.equal(await isPortAvailable(address.port), false, 'test-owned listener holds port')
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })
    assert.equal(await isPortAvailable(address.port), true, 'port released after owned server close')
    await assert.rejects(isPortAvailable(0), /KAN-885/i)
    await assert.rejects(isPortAvailable(65536), /KAN-885/i)
  } finally {
    if (server.listening) {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }
})
