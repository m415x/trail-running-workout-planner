import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '@/db/schema'
import { getEligibleAthletesForSportingGroup } from '@/lib/groups/eligible-athletes'

function createFixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      role TEXT NOT NULL,
      user_name TEXT NOT NULL,
      email TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL
    );
    CREATE TABLE athlete_groups (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      category_code TEXT NOT NULL,
      level_code TEXT NOT NULL,
      team_id TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE athlete_profiles (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      group_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      nick_name TEXT,
      dni TEXT NOT NULL,
      birthday TEXT,
      phone TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      physiology TEXT,
      medical TEXT
    );
  `)

  const now='2026-09-28T00:00:00.000Z'
  sqlite.prepare(`INSERT INTO teams VALUES ('team_1','Team 1',0,?,?)`).run(now,now)
  sqlite.prepare(`INSERT INTO teams VALUES ('team_2','Team 2',0,?,?)`).run(now,now)

  const insertGroup=sqlite.prepare(`
    INSERT INTO athlete_groups
    (id,is_deleted,created_at,updated_at,category_code,level_code,team_id,description,is_active)
    VALUES (?, ?, ?, ?, 'M','1', ?, NULL, ?)
  `)
  insertGroup.run('target',0,now,now,'team_1',1)
  insertGroup.run('other',0,now,now,'team_1',1)
  insertGroup.run('inactive-target',0,now,now,'team_1',0)
  insertGroup.run('foreign-target',0,now,now,'team_2',1)

  const insertUser=sqlite.prepare(`
    INSERT INTO users
    (id,is_deleted,created_at,updated_at,role,user_name,email,first_name,last_name)
    VALUES (?,0,?,?,'athlete',?,?,?,?)
  `)
  const insertAthlete=sqlite.prepare(`
    INSERT INTO athlete_profiles
    (id,is_deleted,created_at,updated_at,user_id,team_id,group_id,is_active,dni)
    VALUES (?,?,?,?,?,?,?,?,?)
  `)

  function athlete(id:string, teamId:string, groupId:string|null, active=1, deleted=0, first='Ana', last='Trail') {
    insertUser.run(`user-${id}`,now,now,`user-${id}`,`${id}@example.com`,first,last)
    insertAthlete.run(id,deleted,now,now,`user-${id}`,teamId,groupId,active,`dni-${id}`)
  }

  athlete('already-target','team_1','target')
  athlete('transfer','team_1','other',1,0,'Bruno','Move')
  athlete('ungrouped','team_1',null,1,0,'Carla','Free')
  athlete('inactive','team_1','other',0)
  athlete('deleted','team_1','other',1,1)
  athlete('foreign','team_2','foreign-target')

  return { sqlite, db: drizzle(sqlite, { schema }) }
}

describe('KAN-516 eligible sporting group athletes', () => {
  it('returns only active same-team athletes who can be added or transferred', () => {
    const fixture=createFixture()
    try {
      const result=getEligibleAthletesForSportingGroup({
        db: fixture.db,
        teamId: 'team_1',
        groupId: 'target',
      })

      assert.ok(result)
      assert.equal(result.group.id, 'target')
      assert.deepEqual(result.athletes.map((athlete) => athlete.id), ['transfer','ungrouped'])
    } finally {
      fixture.sqlite.close()
    }
  })

  it('rejects inactive or cross-team destination groups', () => {
    const fixture=createFixture()
    try {
      assert.equal(getEligibleAthletesForSportingGroup({
        db: fixture.db,
        teamId: 'team_1',
        groupId: 'inactive-target',
      }), null)

      assert.equal(getEligibleAthletesForSportingGroup({
        db: fixture.db,
        teamId: 'team_1',
        groupId: 'foreign-target',
      }), null)
    } finally {
      fixture.sqlite.close()
    }
  })
})
