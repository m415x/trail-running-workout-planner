import { createServer } from 'node:net'
import { isAbsolute } from 'node:path'

import { writeAcceptanceDevCtrlcProbeState } from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'

/**
 * KAN-885/T3 L6: standalone test-only worker. It exposes a disposable
 * loopback listener and writes its own PID record exclusively. It does not
 * start Next, access SQLite, terminate unrelated processes or enable --run.
 */

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (
    args.length !== 4
    || args[0] !== '--state'
    || args[2] !== '--nonce'
    || !isAbsolute(args[1])
    || !/^[a-f0-9]{32}$/.test(args[3])
    || !Number.isSafeInteger(process.ppid)
    || process.ppid <= 0
    || process.ppid === process.pid
  ) {
    throw new Error('KAN-885: invalid disposable worker arguments')
  }

  const server = createServer(socket => socket.destroy())
  let stopping = false

  const shutdown = () => {
    if (stopping) return
    stopping = true
    server.close(() => {
      process.exitCode = 0
    })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
        server.off('error', reject)
        resolve()
      })
    })

    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('KAN-885: missing disposable worker TCP address')
    }

    await writeAcceptanceDevCtrlcProbeState({
      statePath: args[1],
      state: {
        version: 1,
        parentPid: process.ppid,
        childPid: process.pid,
        port: address.port,
        nonce: args[3],
      },
    })
    // Keep the loopback listener alive until a signal from its owner.
  } catch {
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    if (server.listening) {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
    throw new Error('KAN-885: disposable worker startup failed')
  }
}

void main().catch(() => {
  console.error('KAN-885: disposable Ctrl+C worker failed')
  process.exitCode = 2
})
