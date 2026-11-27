import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import test from 'node:test'

import * as environment from '@/scripts/acceptance-dev-child-env'

type AssertPortAvailable = (port: number) => Promise<void>

test('KAN-885/T3 L5 rejects occupied loopback port without disrupting its owner', async () => {
  const listener = createServer()
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', () => {
      listener.off('error', reject)
      resolve()
    })
  })

  try {
    const address = listener.address()
    assert.ok(address && typeof address !== 'string')
    const port = address.port
    const candidate = (environment as unknown as Record<string, unknown>)
      .assertAcceptanceDevPortAvailable
    assert.equal(typeof candidate, 'function', 'non-destructive loopback port guard is required')
    const assertAvailable = candidate as AssertPortAvailable

    await assert.rejects(
      () => assertAvailable(port),
      /EADDRINUSE|port.*(?:occupied|in use|unavailable)/i,
    )

    assert.equal(listener.listening, true, 'must not close or kill the existing listener')
    const secondProbe = createServer()
    try {
      await assert.rejects(
        () => new Promise<void>((resolve, reject) => {
          secondProbe.once('error', reject)
          secondProbe.listen(port, '127.0.0.1', resolve)
        }),
        /EADDRINUSE/,
        'the original process must still own the port',
      )
    } finally {
      if (secondProbe.listening) {
        secondProbe.close()
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      listener.close(error => error ? reject(error) : resolve())
    })
  }
})
