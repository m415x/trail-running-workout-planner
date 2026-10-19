import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const path = 'scripts/provision-acceptance-athlete-b.ts'

test('KAN-783 dedicated CLI protects operational SQLite and requires explicit subject', async () => {
  const source = await readFile(path, 'utf8')
  assert.match(source, /--database/)
  assert.match(source, /--subject/)
  assert.match(source, /--apply/)
  assert.match(source, /NODE_ENV/)
  assert.match(source, /SQLITE_SCENARIO_MODE/)
  assert.match(source, /fileMustExist/)
  assert.doesNotMatch(source, /provision-h4b-acceptance-actors|db\/seed\.ts/)
})

test('KAN-783 does not embed real Supabase subject or write on default invocation', async () => {
  const source = await readFile(path, 'utf8')
  assert.match(source, /readonly:\s*!apply/)
  assert.match(source, /team_1/)
  assert.match(source, /group_id|groupId/)
  assert.doesNotMatch(source, /1579feb3-60b3-45eb-83f6-c8eb312cd4c8/)
})
