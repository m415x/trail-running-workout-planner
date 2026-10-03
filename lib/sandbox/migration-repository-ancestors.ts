import { lstat as nodeLstat } from 'node:fs/promises'
import { dirname, isAbsolute, parse, resolve, win32 } from 'node:path'

type DirectoryKind = {
  isDirectory: () => boolean
  isSymbolicLink: () => boolean
}

/**
 * Read-only path-boundary preflight for directories ABOVE repositoryRoot.
 * Inspect from the filesystem root downward so an ancestor symlink cannot
 * silently redirect the repository before the journal is inspected.
 *
 * This is a point-in-time check, not a guarantee against concurrent path
 * replacement (TOCTOU). Do not treat it as database migration authorization.
 */
export async function inspectCanonicalRepositoryAncestorDirectories(request: {
  repositoryRoot: string
  lstat?: (path: string) => Promise<DirectoryKind>
}): Promise<void> {
  if (
    typeof request.repositoryRoot !== 'string'
    || !request.repositoryRoot
    || !(isAbsolute(request.repositoryRoot) || win32.isAbsolute(request.repositoryRoot))
  ) {
    throw new Error('Canonical migration repository root must be absolute')
  }

  const repositoryRoot = resolve(request.repositoryRoot)
  const filesystemRoot = parse(repositoryRoot).root
  const ancestors: string[] = []
  let current = dirname(repositoryRoot)

  while (current !== filesystemRoot) {
    ancestors.unshift(current)
    const parent = dirname(current)
    if (parent === current) {
      throw new Error('Canonical migration filesystem ancestor path invalid')
    }
    current = parent
  }
  ancestors.unshift(filesystemRoot)

  const inspect = request.lstat ?? nodeLstat
  for (const path of ancestors) {
    let metadata: DirectoryKind
    try {
      metadata = await inspect(path)
    } catch {
      throw new Error('Canonical migration filesystem ancestor could not be inspected')
    }
    if (!metadata || metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error('Canonical migration filesystem ancestor is symbolic or not a directory')
    }
  }
}
