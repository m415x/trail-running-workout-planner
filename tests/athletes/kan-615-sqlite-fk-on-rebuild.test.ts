import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-615 replaces athlete_profiles with FK ON and preserves all twelve dependent relations', () => {
  const snapshot = JSON.parse(
    readFileSync('drizzle/sqlite/meta/0015_snapshot.json', 'utf8')
  ) as {
    tables: Record<string, {
      foreignKeys?: Record<string, {
        tableTo: string
        onDelete: string
      }>
    }>
  }

  const dependents = Object.entries(snapshot.tables)
    .flatMap(([name, table]) =>
      Object.values(table.foreignKeys ?? {})
        .filter(fk => fk.tableTo === 'athlete_profiles')
        .map(fk => ({ name, action: fk.onDelete.toUpperCase() }))
    )

  assert.equal(dependents.length, 12)

  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')

    sqlite.exec(`
      CREATE TABLE athlete_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL UNIQUE
      );
      INSERT INTO athlete_profiles VALUES ('athlete-1', 'user-1');
    `)

    for (let i = 0; i < dependents.length; i++) {
      const action = dependents[i].action

      assert.ok(['CASCADE', 'RESTRICT'].includes(action))

      sqlite.exec(`
        CREATE TABLE dependent_${i} (
          id TEXT PRIMARY KEY,
          athlete_id TEXT NOT NULL
            REFERENCES athlete_profiles(id) ON DELETE ${action}
        );
        INSERT INTO dependent_${i} VALUES ('record-${i}', 'athlete-1');
      `)
    }

    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])

    const rebuild = sqlite.transaction(() => {
      sqlite.exec(`
        CREATE TABLE __new_athlete_profiles (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT,
          first_name TEXT
        );

        INSERT INTO __new_athlete_profiles (id, user_id)
          SELECT id, user_id FROM athlete_profiles;

        DROP TABLE athlete_profiles;

        ALTER TABLE __new_athlete_profiles
          RENAME TO athlete_profiles;

        CREATE UNIQUE INDEX athlete_profiles_user_team_unique
          ON athlete_profiles(user_id);
      `)
    })

    assert.throws(
      () => rebuild(),
      /FOREIGN KEY constraint failed/
    )

    const originalColumns = sqlite.pragma(
      "table_info(athlete_profiles)"
    ) as Array<{ name: string }>

    assert.equal(
      originalColumns.some(column => column.name === "first_name"),
      false
    )

    assert.deepEqual(
      sqlite.prepare("SELECT * FROM athlete_profiles").all(),
      [{ id: "athlete-1", user_id: "user-1" }]
    )

    const replacement = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = ? AND name = ?"
    ).get("table", "__new_athlete_profiles")

    assert.equal(replacement, undefined)

    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])

    for (let i = 0; i < dependents.length; i++) {
      const row = sqlite.prepare(
        `SELECT athlete_id FROM dependent_${i}`
      ).get() as { athlete_id: string } | undefined

      assert.equal(row?.athlete_id, 'athlete-1')
    }
  } finally {
    sqlite.close()
  }
})
