import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('KAN-588/G2 pure pilot guard does not import runtime, persistence, server actions or navigation', () => {
  const guard = source('lib/groups/group-pilot-intent.ts')
  assert.match(guard, /inspectSandboxDestination/)
  assert.doesNotMatch(guard, /(?:from|import\s*\()\s*['"](?:@\/db|\.\.\/\.\.\/db|better-sqlite3|postgres|drizzle-orm|next\/|@\/app\/actions)/)
  assert.doesNotMatch(guard, /\b(?:connect|migrate|insert|update|delete|execute|revalidatePath|redirect)\s*\(/)
})

test('KAN-588/G2 four existing Group actions remain on SQLite and non-pilot exports are preserved', () => {
  const actions = source('app/actions/group-actions.ts')
  assert.match(actions, /import \{ db \} from '@\/db'/)
  for (const name of [
    'getGroupsByTeam',
    'getGroupById',
    'createGroup',
    'updateGroup',
    'getGroupWithMembers',
    'getEligibleAthletesForGroup',
  ]) {
    assert.match(actions, new RegExp('export async function ' + name + '\\('))
  }
  assert.doesNotMatch(actions, /group-pilot-intent|syntheticGroup|SUPABASE_DIRECT_URL|SUPABASE_DATABASE_URL/)
})

test('KAN-588/G2 approved pilot names do not include membership-related actions', () => {
  const guard = source('lib/groups/group-pilot-intent.ts')
  assert.doesNotMatch(guard, /'getGroupWithMembers'|'getEligibleAthletesForGroup'/)
  assert.match(guard, /'getGroupsByTeam'/)
  assert.match(guard, /'getGroupById'/)
  assert.match(guard, /'createGroup'/)
  assert.match(guard, /'updateGroup'/)
})
