import { existsSync } from 'node:fs'
import { isAbsolute, join, win32 } from 'node:path'

type NativeSupabaseBinaryInput = {
  repositoryRoot: string
  platform: string
  exists?: (path: string) => boolean
}

/**
 * Resolve only the package's native executable, never a shell script,
 * pnpm shim, PATH fallback, or globally installed CLI.
 * Resolution does not execute the binary or access a database.
 */
export function resolveProjectSupabaseBinary(
  request: NativeSupabaseBinaryInput,
): string {
  const { repositoryRoot: root, platform } = request
  if (
    !root
    || root.trim() !== root
    || /[\r\n\0]/.test(root)
    || !(isAbsolute(root) || win32.isAbsolute(root))
  ) {
    throw new Error('An absolute local sandbox repository root is required')
  }

  const binary = join(
    root,
    'node_modules',
    'supabase',
    'bin',
    platform === 'win32' ? 'supabase.exe' : 'supabase',
  )

  try {
    if (!(request.exists ?? existsSync)(binary)) {
      throw new Error('Missing local Supabase binary')
    }
  } catch {
    throw new Error('Project-local Supabase native binary is unavailable')
  }

  return binary
}
