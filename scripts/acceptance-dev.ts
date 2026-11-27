import { resolve } from 'node:path'

import {
  resolveAcceptanceCliSelection,
  saveAcceptanceDatabaseSelection,
} from '@/scripts/acceptance-dev-target'
import { preflightAcceptanceSqlite } from '@/scripts/acceptance-dev-preflight'
import {
  assertAcceptanceDevPortAvailable,
  buildAcceptanceDevNextLaunchPlan,
  runAcceptanceDevWindowsTerminalProcess,
} from '@/scripts/acceptance-dev-child-env'

/**
 * KAN-885: reuse an existing accredited SQLite fixture to run Next locally.
 * The CLI checks the fixture's structure, not a fabricated login identity.
 * Authentic H2 SSR and H1/H3/H4A authorization belong to the application.
 * No provisioning, schema changes or mutation of the parent environment.
 */
const usage = 'Usage: pn acceptance:dev [--db <absolute-accredited-sqlite-path>] [--port <1024-65535>]'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage)
    return
  }

  try {
    // Port is a launcher option; leave --db parsing and saved selection
    // precedence with the existing strict target resolver.
    const portOption = args.indexOf('--port')
    const hasPort = portOption !== -1
    if (hasPort && (
      portOption !== args.length - 2
      || !/^[0-9]+$/.test(args[portOption + 1] ?? '')
    )) {
      throw new Error('KAN-885: invalid acceptance dev port arguments')
    }
    const port = hasPort ? Number(args[portOption + 1]) : 3000
    const selectionArgs = hasPort ? args.slice(0, portOption) : args
    const projectRoot = resolve(import.meta.dirname, '..')
    const configPath = resolve(projectRoot, '.acceptance-dev.local.json')
    const databasePath = resolveAcceptanceCliSelection({
      args: selectionArgs,
      projectRoot,
      configPath,
    })

    // Full structural/integrity preflight on EVERY invocation. Do not demand
    // subject/teamId at launch: SSR authenticates inside the real application.
    const accredited = preflightAcceptanceSqlite({ databasePath, projectRoot })
    const plan = buildAcceptanceDevNextLaunchPlan({
      databasePath: accredited,
      projectRoot,
      inheritedEnv: process.env,
      port,
    })
    await assertAcceptanceDevPortAvailable(port)

    // Preserve platform-independent negative preflight behavior (including
    // Linux CI); refuse unsupported process management before saving config.
    if (process.platform !== 'win32') {
      throw new Error('KAN-885: managed acceptance launcher currently requires Windows')
    }

    // Saved selection is a non-sensitive locator only. Write it after all
    // preflight checks, never on failed or unaccredited --db attempts.
    if (selectionArgs.length === 2) {
      saveAcceptanceDatabaseSelection({
        databasePath: accredited,
        projectRoot,
        configPath,
      })
    }

    console.log('KAN-885: starting acceptance Next.js on loopback; Ctrl+C stops the server')
    const exitCode = await runAcceptanceDevWindowsTerminalProcess({ plan })
    if (exitCode !== 0) {
      console.error('KAN-885: acceptance Next.js exited unsuccessfully')
    }
    process.exitCode = exitCode
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') {
      console.error('KAN-885: acceptance SQLite file does not exist')
    } else if (error instanceof Error && error.message.startsWith('KAN-885:')) {
      console.error(error.message)
    } else {
      console.error('KAN-885: acceptance launcher failed')
    }
    process.exitCode = 2
  }
}

void main().catch(() => {
  console.error('KAN-885: acceptance launcher failed')
  process.exitCode = 2
})
