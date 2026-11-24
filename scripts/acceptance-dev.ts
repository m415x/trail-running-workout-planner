import { resolve } from 'node:path'
import { preflightAcceptanceSqlite } from '@/scripts/acceptance-dev-preflight'

/**
 * KAN-885/T3: CLI argument, accredited target and read-only SQLite preflight.
 *
 * The launcher remains deliberately disabled after path accreditation until
 * config, runtime actor, child environment and lifecycle checks are complete.
 * Never starts Next.js, creates SQLite, provisions or mutates data in this cut.
 */
const usage = 'Usage: pn acceptance:dev --db <absolute-accredited-sqlite-path>'
const args = process.argv.slice(2)

if (args.length === 1 && args[0] === '--help') {
  console.log(usage)
} else if (args.length === 0) {
  // No implicit fallback to sqlite.db, OS temp search, or new fixture creation.
  // Persisted selection loading is implemented only after its own safety contract.
  console.error('KAN-885: saved SQLite selection is missing; ' + usage)
  process.exitCode = 2
} else if (args.length === 2 && args[0] === '--db' && args[1]?.trim()) {
  try {
    // A missing authenticated actor must fail closed at the H1 boundary.
    // The CLI cannot invent a Supabase subject or Team membership.
    preflightAcceptanceSqlite({
      databasePath: args[1],
      projectRoot: resolve(import.meta.dirname, '..'),
    })
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
} else {
  console.error('KAN-885: invalid launcher arguments; ' + usage)
  process.exitCode = 2
}
