import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-615 snapshot 0029 matches AthleteProfile identity contract', () => {
  const previous = JSON.parse(
    readFileSync('drizzle/supabase/meta/0028_snapshot.json', 'utf8'),
  )

  const current = JSON.parse(
    readFileSync('drizzle/supabase/meta/0029_snapshot.json', 'utf8'),
  )

  assert.equal(current.version, '7')
  assert.equal(current.dialect, 'postgresql')
  assert.equal(current.prevId, previous.id)
  assert.notEqual(current.id, previous.id)

  const before = previous.tables['public.athlete_profiles']
  const after = current.tables['public.athlete_profiles']

  assert.ok(before)
  assert.ok(after)

  for (const name of ['first_name', 'last_name', 'contact_email']) {
    assert.equal(before.columns[name], undefined)
    assert.equal(after.columns[name]?.type, 'text')
    assert.equal(after.columns[name]?.notNull, false)
  }

  assert.equal(before.columns.user_id.notNull, true)
  assert.equal(after.columns.user_id.notNull, false)

  assert.ok(before.uniqueConstraints.athlete_profiles_user_id_unique)
  assert.equal(
    after.uniqueConstraints.athlete_profiles_user_id_unique,
    undefined,
  )

  const index = after.indexes.athlete_profiles_user_team_unique
  assert.ok(index, 'Missing composite unique index')
  assert.equal(index.isUnique, true)

  assert.deepEqual(
    index.columns.map((column: { expression: string }) =>
      column.expression
    ),
    ['user_id', 'team_id'],
  )

  assert.equal(
    before.foreignKeys.athlete_profiles_user_id_users_id_fk.onDelete,
    'cascade',
  )

  assert.equal(
    after.foreignKeys.athlete_profiles_user_id_users_id_fk.onDelete,
    'restrict',
  )

  assert.deepEqual(
    after.foreignKeys.athlete_profiles_team_id_teams_id_fk,
    before.foreignKeys.athlete_profiles_team_id_teams_id_fk,
  )

  assert.deepEqual(
    after.foreignKeys.athlete_profiles_group_id_athlete_groups_id_fk,
    before.foreignKeys.athlete_profiles_group_id_athlete_groups_id_fk,
  )

  assert.deepEqual(
    Object.keys(after.columns).sort(),
    [...Object.keys(before.columns),
      'first_name', 'last_name', 'contact_email'].sort(),
  )

  for (const name of Object.keys(before.columns)) {
    if (name === 'user_id') continue
    assert.deepEqual(after.columns[name], before.columns[name])
  }
})
