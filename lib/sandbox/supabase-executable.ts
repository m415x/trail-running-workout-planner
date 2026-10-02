import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, win32 } from 'node:path'

type NativeSupabaseBinaryInput = {
  repositoryRoot: string
  platform: string
  architecture?: string
  exists?: (path: string) => boolean
  realpath?: (path: string) => string
  resolveOptionalBinary?: (packageRoot: string, specifier: string) => string
}

function defaultResolveOptionalBinary(packageRoot: string, specifier: string): string {
  return createRequire(join(packageRoot, 'package.json')).resolve(specifier)
}

function optionalBinarySpecifier(platform: string, architecture: string): string {
  const supported: Record<string, string> = {
    'win32-x64': '@supabase/cli-windows-x64/bin/supabase.exe',
    'win32-arm64': '@supabase/cli-windows-arm64/bin/supabase.exe',
    'linux-x64': '@supabase/cli-linux-x64/bin/supabase',
    'linux-arm64': '@supabase/cli-linux-arm64/bin/supabase',
    'darwin-x64': '@supabase/cli-darwin-x64/bin/supabase',
    'darwin-arm64': '@supabase/cli-darwin-arm64/bin/supabase',
  }
  const specifier = supported[`${platform}-${architecture}`]
  if (!specifier) {
    throw new Error('Unsupported local Supabase native binary platform')
  }
  return specifier
}

/**
 * Only a native executable belonging to this repository's node_modules may
 * run. Prefer the historic direct bin layout if present; modern pnpm installs
 * expose platform binaries as optional packages resolved from Supabase itself.
 * Never scan pnpm version directories or fall back to PATH or a cmd shim.
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

  const executableName = platform === 'win32' ? 'supabase.exe' : 'supabase'
  const legacy = join(root, 'node_modules', 'supabase', 'bin', executableName)
  const exists = request.exists ?? existsSync

  try {
    if (exists(legacy)) return legacy

    const packageRoot = (request.realpath ?? realpathSync)(
      join(root, 'node_modules', 'supabase'),
    )
    const specifier = optionalBinarySpecifier(platform, request.architecture ?? process.arch)
    const binary = (request.resolveOptionalBinary ?? defaultResolveOptionalBinary)(
      packageRoot, specifier,
    )

    const within = relative(join(root, 'node_modules'), binary)
    if (
      !within
      || within === '..'
      || within.startsWith('..' + (platform === 'win32' ? '\\' : '/'))
      || isAbsolute(within)
      || win32.isAbsolute(within)
      || !binary.endsWith('/' + executableName) && !binary.endsWith('\\' + executableName)
      || !exists(binary)
    ) {
      throw new Error('Missing native executable')
    }

    return binary
  } catch {
    throw new Error('Project-local Supabase native binary is unavailable')
  }
}
