import { createServer } from 'node:net'

/**
 * KAN-885/T3 L6: OS observations for the standalone Ctrl+C diagnostic.
 * Neither function sends a termination signal or modifies application data.
 */
export function isAcceptanceDevCtrlcProbePidAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error('KAN-885: invalid Ctrl+C diagnostic process identifier')
  }

  try {
    // Signal 0 probes existence; it does not terminate the process.
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'ESRCH') return false
    if (code === 'EPERM') return true
    // Unknown inspection errors cannot establish that a PID is absent.
    throw new Error('KAN-885: Ctrl+C diagnostic process inspection failed')
  }
}

/**
 * Temporarily attempt a bind on loopback only. EADDRINUSE means occupied;
 * all other socket errors fail closed rather than claiming availability.
 * A successful bind is closed before returning true.
 */
export async function isAcceptanceDevCtrlcProbePortAvailable(port: number): Promise<boolean> {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('KAN-885: invalid Ctrl+C diagnostic loopback port')
  }

  const server = createServer()
  return new Promise<boolean>((resolve, reject) => {
    let finished = false
    const finish = (available: boolean | null) => {
      if (finished) return
      finished = true
      server.off('error', onError)
      if (available === null) {
        reject(new Error('KAN-885: Ctrl+C diagnostic loopback inspection failed'))
      } else {
        resolve(available)
      }
    }
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        finish(false)
      } else {
        finish(null)
      }
    }
    server.once('error', onError)
    try {
      server.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
        server.close(error => {
          finish(error ? null : true)
        })
      })
    } catch {
      finish(null)
    }
  })
}
