import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  [require.resolve('drizzle-kit/bin.cjs'), 'migrate', '--config=drizzle.sqlite.config.ts'],
  { stdio: 'inherit' },
)

if (result.error) throw result.error
process.exit(result.status ?? 1)
