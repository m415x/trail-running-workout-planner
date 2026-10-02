import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'

test('KAN-585 disables parallel Supabase migration and seed mechanisms', async () => {
  const config = await readFile('supabase/config.toml', 'utf8')
  const sections = Object.fromEntries(
    [...config.matchAll(/^\[([^\]]+)\]\s*$([\s\S]*?)(?=^\[[^\]]+\]\s*$|$(?![\s\S]))/gm)]
      .map((match) => [match[1], match[2]]),
  )
  assert.match(sections['db.migrations'] ?? '', /^enabled\s*=\s*false\s*$/m)
  assert.match(sections['db.seed'] ?? '', /^enabled\s*=\s*false\s*$/m)
  const names = await readdir('supabase')
  assert.equal(names.includes('migrations'), false)
  assert.equal(names.includes('seed.sql'), false)
})
