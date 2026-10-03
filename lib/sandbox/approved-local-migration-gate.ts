import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve, win32 } from 'node:path'

import { readApprovedLocalSandboxPin } from './local-cluster-pin'
import { requireSpecificLocalMigrationApproval } from './local-migration-approval'
import { inspectSandboxDestination } from './sandbox-destination'

type VerifiedMigrationInput = {
  repositoryRoot: string
  directUrl: string
  expectedClusterSystemIdentifier: string
}

/**
 * Structural approval gate only; no DB client, transaction or SQL lives here.
 * The injected migrator must independently verify the live cluster identity,
 * canonical files, fresh journal and mutation transaction before any DDL.
 * The approval document is not evidence of an operator's actual consent.
 */
export async function withApprovedLocalMigrationGate(request: {
  repositoryRoot: string
  directUrl?: string
  approval?: unknown
  readTrustedDocument?: (path: string) => Promise<string>
  runVerifiedMigration: (input: VerifiedMigrationInput) => Promise<void>
}): Promise<void> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (
    typeof request.repositoryRoot !== 'string'
    || !request.repositoryRoot
    || !(isAbsolute(request.repositoryRoot) || win32.isAbsolute(request.repositoryRoot))
  ) {
    throw new Error('Absolute local migration repository root required')
  }

  const approvalPath = resolve(request.repositoryRoot, '.coach-sandbox-local/approved-cluster.json')
  const reader = request.readTrustedDocument ?? ((path: string) => readFile(path, 'utf8'))
  const expectedClusterSystemIdentifier = await readApprovedLocalSandboxPin({
    readTrustedDocument: () => reader(approvalPath),
  })

  requireSpecificLocalMigrationApproval({
    expectedClusterSystemIdentifier,
    approval: request.approval,
  })

  try {
    await request.runVerifiedMigration({
      repositoryRoot: request.repositoryRoot,
      directUrl: request.directUrl as string,
      expectedClusterSystemIdentifier,
    })
  } catch {
    throw new Error('Local sandbox verified migration callback failed')
  }
}
