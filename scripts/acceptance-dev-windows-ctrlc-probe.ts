import { lstat, readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import {
  verifyAcceptanceDevCtrlcProbeState,
} from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'
import {
  isAcceptanceDevCtrlcProbePidAlive,
  isAcceptanceDevCtrlcProbePortAvailable,
} from '@/scripts/acceptance-dev-windows-ctrlc-probe-os'

/**
 * KAN-885/T3 L6 — standalone manual Ctrl+C diagnostic interface.
 * Only read-only --verify is enabled. --run is deliberately fail-closed.
 * No Next launch, SQLite access, OS kill or mutation of probe files.
 */
const usage = [
  'KAN-885 Windows Ctrl+C diagnostic for Git Bash',
  'Usage: pn exec tsx scripts/acceptance-dev-windows-ctrlc-probe.ts --help',
  'Planned manual workflow:',
  '  --run     Start an isolated disposable Node process tree (not enabled yet)',
  '  --verify --state <absolute-path> --nonce <hex32>',
  '            Inspect two PIDs and a loopback port after Ctrl+C (read-only)',
  '--run is currently disabled; --verify never terminates any process.',
].join('\n')

const args = process.argv.slice(2)
const maxStateBytes = 4096

async function verifyFromCli(statePath: string, nonce: string): Promise<void> {
  if (
    !isAbsolute(statePath)
    || typeof nonce !== 'string'
    || !/^[a-f0-9]{32}$/.test(nonce)
  ) {
    throw new Error('KAN-885: invalid Ctrl+C verification arguments')
  }

  let raw: string
  try {
    const metadata = await lstat(statePath)
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maxStateBytes) {
      throw new Error('Invalid probe record')
    }
    const bytes = await readFile(statePath)
    if (bytes.byteLength === 0 || bytes.byteLength > maxStateBytes) {
      throw new Error('Invalid probe record')
    }
    raw = bytes.toString('utf8')
  } catch {
    throw new Error('KAN-885: unable to read Ctrl+C diagnostic record')
  }

  await verifyAcceptanceDevCtrlcProbeState({
    raw,
    expectedNonce: nonce,
    isPidAlive: isAcceptanceDevCtrlcProbePidAlive,
    isPortAvailable: isAcceptanceDevCtrlcProbePortAvailable,
  })
}

async function main(): Promise<void> {
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage)
    return
  }
  if (
    args.length === 5
    && args[0] === '--verify'
    && args[1] === '--state'
    && args[3] === '--nonce'
  ) {
    try {
      await verifyFromCli(args[2], args[4])
      console.log('KAN-885: Ctrl+C diagnostic verification PASS')
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('KAN-885:')
        ? error.message
        : 'KAN-885: Ctrl+C diagnostic verification failed'
      console.error(message)
      process.exitCode = 2
    }
    return
  }
  if (args[0] === '--run') {
    if (
      args.length !== 5
      || args[1] !== '--state'
      || args[3] !== '--nonce'
      || !isAbsolute(args[2])
      || !/^[a-f0-9]{32}$/.test(args[4])
    ) {
      console.error('KAN-885: invalid disposable Ctrl+C run arguments')
      process.exitCode = 2
      return
    }

    // Preflight only. No process is created, and the destination is not
    // reserved or written until a separate positive --run contract passes.
    try {
      await lstat(args[2])
      console.error('KAN-885: existing Ctrl+C diagnostic state cannot be overwritten')
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        console.error('KAN-885: disposable Ctrl+C run is not enabled yet')
      } else {
        console.error('KAN-885: unable to inspect Ctrl+C diagnostic state')
      }
    }
    process.exitCode = 2
    return
  }

  console.error('KAN-885: invalid diagnostic arguments; usage: --help | --run --state <absolute-path> --nonce <hex32> | --verify --state <absolute-path> --nonce <hex32>')
  process.exitCode = 2
}

void main().catch(() => {
  console.error('KAN-885: Ctrl+C diagnostic verification failed')
  process.exitCode = 2
})
