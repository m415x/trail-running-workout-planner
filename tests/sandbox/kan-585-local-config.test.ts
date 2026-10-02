import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

test('KAN-585 keeps Supabase local config isolated and disables automatic seeds', async () => {
  const config = await readFile('supabase/config.toml', 'utf8')
  assert.match(config, /^project_id\s*=\s*"trail-running-workout-planner"\s*$/m)
  assert.match(config, /^\[db\]\s*\n(?:[^[]*\n)*?port\s*=\s*54322\s*$/m)
  assert.match(config, /^\[db\.seed\]\s*\n(?:[^[]*\n)*?enabled\s*=\s*false\s*$/m)
})

test('KAN-585 preserves Drizzle as the sole application migration authority', async () => {
  const files = await readdir('supabase')
  assert.equal(files.includes('migrations'), false)
  assert.equal(files.includes('seed.sql'), false)
  assert.ok(files.includes('config.toml'))
  const journal = await readFile(join('drizzle', 'supabase', 'meta', '_journal.json'), 'utf8')
  assert.equal(JSON.parse(journal).dialect, 'postgresql')
})
