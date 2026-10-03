import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { probeApprovedLocalPostgresJsDrizzle } from '../lib/sandbox/approved-local-drizzle-probe'
import { createLocalPostgresJsDrizzleProbeDriver } from '../lib/sandbox/local-postgres-js-drizzle-driver'

// Supabase CLI's fixed local development endpoint. This command never accepts
// connection strings, cloud targets or environment-based endpoint overrides.
const localDirectUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

type ProbeResult = { verified: true; freshJournal: true }

/**
 * Explicitly invoked, diagnostic-only CLI. An empty argument list is required
 * before reading operator approval or opening the local database connection.
 * The successful output discloses booleans only, never secrets or cluster IDs.
 */
export async function runCoachSandboxReadOnlyProbeCli(request: {
  args: readonly string[]
  repositoryRoot: string
  probe?: (repositoryRoot: string) => Promise<ProbeResult>
}): Promise<ProbeResult> {
  if (request.args.length !== 0) {
    throw new Error('Coach sandbox read-only probe does not accept arguments')
  }

  const probe = request.probe ?? (repositoryRoot =>
    probeApprovedLocalPostgresJsDrizzle({
      repositoryRoot,
      directUrl: localDirectUrl,
      openDriver: async () => createLocalPostgresJsDrizzleProbeDriver({
        directUrl: localDirectUrl,
      }),
    })
  )

  try {
    const result = await probe(request.repositoryRoot)
    if (result?.verified !== true || result.freshJournal !== true) {
      throw new Error('Unverified sandbox result')
    }
    return { verified: true, freshJournal: true }
  } catch {
    throw new Error('Local sandbox read-only probe verification failed')
  }
}

async function main(): Promise<void> {
  try {
    const result = await runCoachSandboxReadOnlyProbeCli({
      args: process.argv.slice(2),
      repositoryRoot: process.cwd(),
    })
    process.stdout.write(
      `Local sandbox probe: verified=${result.verified} freshJournal=${result.freshJournal}\n`,
    )
  } catch {
    process.stderr.write('Local sandbox read-only probe failed\n')
    process.exitCode = 1
  }
}

// Importing this module in a test must never contact PostgreSQL.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main()
}
