import { constants } from 'node:fs'
import { lstat, open } from 'node:fs/promises'
import { isAbsolute, join, win32 } from 'node:path'

import { readApprovedLocalSandboxPin } from './local-cluster-pin'

type DirectoryInspection = {
  isDirectory: () => boolean
  isSymbolicLink: () => boolean
}

type FileInspection = {
  isFile: () => boolean
  isSymbolicLink: () => boolean
}

type PinFileHandle = {
  stat: () => Promise<FileInspection>
  readFile: (options?: { encoding: 'utf8' }) => Promise<string>
  close: () => Promise<void>
}

type LocalPinFileRequest = {
  repositoryRoot: string
  inspectDirectory?: (path: string) => Promise<DirectoryInspection>
  openFile?: (path: string, flags: number) => Promise<PinFileHandle>
}

/**
 * Operator approval is read via a single open file descriptor, not through
 * separate path-based lstat/readFile calls. The directory must not be a
 * symlink; O_NOFOLLOW additionally rejects a final-component symlink where
 * supported. The handle is closed in all outcomes.
 *
 * This protects against swapping the final path after opening the handle.
 * The non-atomic directory lstat remains a limitation on platforms where
 * openat-style directory-relative handling is unavailable (notably Windows).
 * The operator approval directory must be locally controlled.
 *
 * This function performs no PostgreSQL operation and never grants mutation
 * authority by itself.
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

  const directory = join(root, '.coach-sandbox-local')
  const path = join(directory, 'approved-cluster.json')
  let handle: PinFileHandle | undefined

  try {
    const parent = await (request.inspectDirectory ?? lstat)(directory)
    if (!parent.isDirectory() || parent.isSymbolicLink()) {
      throw new Error('Invalid approval directory')
    }

    handle = await (request.openFile ?? open)(path, constants.O_RDONLY | constants.O_NOFOLLOW) as PinFileHandle
    const stat = await handle.stat()
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('Invalid approval file')
    }

    return await readApprovedLocalSandboxPin({
      readTrustedDocument: () => handle!.readFile({ encoding: 'utf8' }),
    })
  } catch {
    throw new Error('Trusted local sandbox pin file unavailable or invalid')
  } finally {
    if (handle) {
      try {
        await handle.close()
      } catch {
        throw new Error('Trusted local sandbox pin file closure failed')
      }
    }
  }
}
