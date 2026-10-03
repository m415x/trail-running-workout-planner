import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve, win32 } from 'node:path'

import { readApprovedLocalSandboxPin } from './local-cluster-pin'
import { probeLocalSandboxPostgresJsDrizzle } from './postgres-js-drizzle-probe'
import { inspectSandboxDestination } from './sandbox-destination'

/** Verify independent local approval before starting any probe connection. */
export async function probeApprovedLocalPostgresJsDrizzle(request: {
  repositoryRoot: string
  directUrl?: string
  readTrustedDocument?: (path: string) => Promise<string>
  openDriver: Parameters<typeof probeLocalSandboxPostgresJsDrizzle>[0]['openDriver']
}): Promise<{ verified: true; freshJournal: true }> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (
    typeof request.repositoryRoot !== 'string'
    || !request.repositoryRoot
    || !(isAbsolute(request.repositoryRoot) || win32.isAbsolute(request.repositoryRoot))
  ) {
    throw new Error('Absolute local sandbox repository root required')
  }

  const approvalPath = resolve(request.repositoryRoot, '.coach-sandbox-local/approved-cluster.json')
  const reader = request.readTrustedDocument ?? ((path: string) => readFile(path, 'utf8'))
  const expectedClusterSystemIdentifier = await readApprovedLocalSandboxPin({
    readTrustedDocument: () => reader(approvalPath),
  })

  return probeLocalSandboxPostgresJsDrizzle({
    directUrl: request.directUrl,
    expectedClusterSystemIdentifier,
    openDriver: request.openDriver,
  })
}
