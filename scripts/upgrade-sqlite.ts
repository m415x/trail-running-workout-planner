import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')

function run(args: string[]): void {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run([
  require.resolve('drizzle-kit/bin.cjs'),
  'migrate',
  '--config=drizzle.sqlite.config.ts',
])
run([tsxCli, resolve('scripts/verify-sqlite.ts')])
