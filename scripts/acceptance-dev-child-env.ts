import { resolve } from 'node:path'

export interface AcceptanceDevChildEnvInput {
  inheritedEnv: Readonly<Record<string, string | undefined>>
  databasePath: string
  projectRoot: string
}

/**
 * KAN-885/T3: minimal, explicit Next child-process environment.
 *
 * Do not spread the parent environment. Sensitive auth material and SQLite
 * provisioning acknowledgments must never be implicitly inherited.
 * This constructs data only: it does not start a child process or access SQLite.
 */
export function buildAcceptanceDevChildEnv(input: AcceptanceDevChildEnvInput): NodeJS.ProcessEnv {
  if (!input.databasePath?.trim()) {
    throw new Error('KAN-885: accredited SQLite database path is missing')
  }
  if (!input.projectRoot?.trim()) {
    throw new Error('KAN-885: project root path is missing')
  }

  // Required cross-platform process/runtime plumbing only. Authentication
  // configuration will need a separate reviewed contract and explicit inputs.
  const allowed = [
    'PATH',
    'Path',
    'HOME',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
    'SYSTEMROOT',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'TMPDIR',
    'COMSPEC',
    'PATHEXT',
    'APPDATA',
    'LOCALAPPDATA',
    'LANG',
    'LC_ALL',
    'TERM',
  ] as const

  // Next 16 augments ProcessEnv with a required, readonly NODE_ENV.
  // A development-only launcher must set it explicitly, not inherit production.
  const child: NodeJS.ProcessEnv = { NODE_ENV: 'development' }
  for (const name of allowed) {
    const value = input.inheritedEnv[name]
    if (value !== undefined) {
      child[name] = value
    }
  }

  child.SQLITE_DATABASE_PATH = input.databasePath
  child.SQLITE_SCENARIO_MODE = '1'
  child.EPT_IDENTITY_BACKEND = 'sqlite'
  child.TSX_TSCONFIG_PATH = resolve(input.projectRoot, 'tsconfig.json')
  return child
}
