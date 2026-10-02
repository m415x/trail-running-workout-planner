import { lstat, readFile } from 'node:fs/promises'
import { isAbsolute, join, win32 } from 'node:path'

import { readApprovedLocalSandboxPin } from './local-cluster-pin'

type FileInspection = {
  isFile: () => boolean
  isSymbolicLink: () => boolean
}

type LocalPinFileRequest = {
  repositoryRoot: string
  inspect?: (path: string) => Promise<FileInspection>
  read?: (path: string) => Promise<string>
}

/**
 * Reads a fixed, untracked local approval document. The file is a prerequisite
 * for later authorization, not permission to execute migrations or seed data.
 * This function performs no database I/O.
 */
export async function loadApprovedLocalSandboxPinFile(
  request: LocalPinFileRequest,
): Promise<string> {
  const root = request.repositoryRoot
  if (
    typeof root !== 'string'
    || !root
    || root.trim() !== root
    || /[\r\n\0]/.test(root)
    || !(isAbsolute(root) || win32.isAbsolute(root))
  ) {
    throw new Error('Trusted local sandbox pin root is invalid')
  }

  const path = join(root, '.coach-sandbox-local', 'approved-cluster.json')

  try {
    const inspection = await (request.inspect ?? lstat)(path)
    if (!inspection.isFile() || inspection.isSymbolicLink()) {
      throw new Error('Approval file is not a regular file')
    }

    return await readApprovedLocalSandboxPin({
      readTrustedDocument: () => (request.read ?? ((file: string) => readFile(file, 'utf8')))(path),
    })
  } catch {
    // Never expose filesystem paths or contents from an underlying error.
    throw new Error('Trusted local sandbox pin file unavailable or invalid')
  }
}
