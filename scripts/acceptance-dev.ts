import { resolve } from 'node:path'
import { resolveAcceptanceCliSelection } from '@/scripts/acceptance-dev-target'
import { preflightAcceptanceSqlite } from '@/scripts/acceptance-dev-preflight'

/**
 * KAN-885/T3: selection and read-only SQLite preflight only.
 *
 * Missing H2-derived runtime actor always fails closed at the H1 boundary.
 * Never starts Next.js, creates SQLite, provisions or mutates data in this cut.
 */
const usage = 'Usage: pn acceptance:dev --db <absolute-accredited-sqlite-path>'
const args = process.argv.slice(2)

if (args.length === 1 && args[0] === '--help') {
  console.log(usage)
} else {
  try {
    const projectRoot = resolve(import.meta.dirname, '..')
    const databasePath = resolveAcceptanceCliSelection({
      args,
      projectRoot,
      configPath: resolve(projectRoot, '.acceptance-dev.local.json'),
    })

    // Mandatory full readonly preflight after either selection route.
    // No subject or Team may be fabricated by the CLI.
    preflightAcceptanceSqlite({ databasePath, projectRoot })
    console.error('KAN-885: acceptance launcher is not yet enabled; ' + usage)
    process.exitCode = 2
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') {
      console.error('KAN-885: acceptance SQLite file does not exist')
    } else if (error instanceof Error && error.message.startsWith('KAN-885:')) {
      console.error(error.message)
    } else {
      console.error('KAN-885: acceptance SQLite target accreditation failed')
    }
    process.exitCode = 2
  }
}
