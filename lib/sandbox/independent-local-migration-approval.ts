import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve, win32 } from 'node:path'

import { readApprovedLocalSandboxPin } from './local-cluster-pin'
import { requireSpecificLocalMigrationApproval } from './local-migration-approval'
import { inspectSandboxDestination } from './sandbox-destination'

type MigrationApproval = {
  operation: 'migrate'
  approvedByOperator: true
  approvedClusterSystemIdentifier: string
}

/**
 * Read physical pin and migration intent from distinct local files before
 * delegating. Validating documents is not proof of human consent or live
 * PostgreSQL identity; callers must obtain explicit operational approval
 * and verify identity in the real transaction before executing any DDL.
 *
 * No database client, SQL, seed, reset or migration is executed here.
 */
export async function withIndependentLocalMigrationApproval(request: {
  repositoryRoot: string
  directUrl?: string
  readTrustedDocument?: (path: string) => Promise<string>
  runApprovedMigration: (input: {
    repositoryRoot: string
    directUrl: string
    approval: MigrationApproval
  }) => Promise<void>
}): Promise<void> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (
    typeof request.repositoryRoot !== 'string'
    || request.repositoryRoot.length === 0
    || !(isAbsolute(request.repositoryRoot) || win32.isAbsolute(request.repositoryRoot))
  ) {
    throw new Error('Absolute local sandbox repository root required')
  }

  const reader = request.readTrustedDocument ?? ((path: string) => readFile(path, 'utf8'))
  const trustedPinPath = resolve(request.repositoryRoot, '.coach-sandbox-local/approved-cluster.json')
  const approvedClusterSystemIdentifier = await readApprovedLocalSandboxPin({
    readTrustedDocument: () => reader(trustedPinPath),
  })

  const approvalPath = resolve(request.repositoryRoot, '.coach-sandbox-local/approved-migration.json')
  let approval: unknown
  try {
    const raw = await reader(approvalPath)
    if (typeof raw !== 'string' || raw.length > 4096) {
      throw new Error('Invalid approval document')
    }
    approval = JSON.parse(raw)
  } catch {
    // No file paths, sensitive file contents or credentials in diagnostics.
    throw new Error('Independent local migration approval unavailable')
  }

  requireSpecificLocalMigrationApproval({
    expectedClusterSystemIdentifier: approvedClusterSystemIdentifier,
    approval,
  })

  // Type is narrowed by the explicit fail-closed validation above.
  await request.runApprovedMigration({
    repositoryRoot: request.repositoryRoot,
    directUrl: request.directUrl as string,
    approval: approval as MigrationApproval,
  })
}
