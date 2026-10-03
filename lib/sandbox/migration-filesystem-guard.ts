import { lstat as nodeLstat } from 'node:fs/promises'
import { isAbsolute, resolve, win32 } from 'node:path'

type FileKind = {
  isSymbolicLink: () => boolean
  isDirectory: () => boolean
  isFile: () => boolean
}

const canonicalFilename = /^\d{4}_[a-z0-9_]+\.sql$/

/**
 * Inspect every canonical migration boundary with lstat (not stat): links
 * must not redirect SQL or journal reads outside the selected repository.
 * This is a read-only preflight, not protection against concurrent changes
 * between path inspection and file opening.
 */
export async function inspectCanonicalMigrationFilesystemPaths(request: {
  repositoryRoot: string
  orderedMigrationFiles: readonly string[]
  lstat?: (path: string) => Promise<FileKind>
}): Promise<void> {
  const { repositoryRoot, orderedMigrationFiles } = request

  if (
    typeof repositoryRoot !== 'string'
    || !repositoryRoot
    || !(isAbsolute(repositoryRoot) || win32.isAbsolute(repositoryRoot))
  ) {
    throw new Error('Canonical migration repository root must be absolute')
  }

  if (
    !Array.isArray(orderedMigrationFiles)
    || orderedMigrationFiles.length === 0
    || orderedMigrationFiles.some((filename, index) => (
      typeof filename !== 'string'
      || !canonicalFilename.test(filename)
      || Number(filename.slice(0, 4)) !== index
    ))
  ) {
    throw new Error('Canonical migration SQL filename inventory invalid')
  }

  const root = resolve(repositoryRoot)
  const entries: { path: string; kind: 'directory' | 'file' }[] = [
    { path: root, kind: 'directory' },
    { path: resolve(root, 'drizzle'), kind: 'directory' },
    { path: resolve(root, 'drizzle/supabase'), kind: 'directory' },
    { path: resolve(root, 'drizzle/supabase/meta'), kind: 'directory' },
    { path: resolve(root, 'drizzle/supabase/meta/_journal.json'), kind: 'file' },
    ...orderedMigrationFiles.map(filename => ({
      path: resolve(root, 'drizzle/supabase', filename),
      kind: 'file' as const,
    })),
  ]

  const inspect = request.lstat ?? nodeLstat
  for (const entry of entries) {
    let metadata: FileKind
    try {
      metadata = await inspect(entry.path)
    } catch {
      throw new Error('Canonical migration filesystem path could not be inspected')
    }
    if (
      !metadata
      || metadata.isSymbolicLink()
      || (entry.kind === 'directory' ? !metadata.isDirectory() : !metadata.isFile())
    ) {
      throw new Error('Canonical migration filesystem type or symbolic link mismatch')
    }
  }
}
