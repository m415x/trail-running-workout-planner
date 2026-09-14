import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import Database from 'better-sqlite3'
import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'

function legacyDatabase() {
  const db = new Database(':memory:')
  db.exec(readFileSync('drizzle/sqlite/0000_baseline.sql', 'utf8'))
  db.exec(`INSERT INTO teams (id,created_at,updated_at,name) VALUES ('t','now','now','Team');
    INSERT INTO users (id,created_at,updated_at,user_name,email,first_name,last_name) VALUES ('u','now','now','user','u@example.test','Test','User');
    INSERT INTO athlete_profiles (id,created_at,updated_at,user_id,team_id,dni) VALUES ('a','now','now','u','t','test');
    INSERT INTO workout_logs (id,created_at,updated_at,athlete_id,date,duration_min,logged_at)
      VALUES ('legacy','now','now','a','2026-09-12',45,'2026-09-13T12:00:00Z');
    INSERT INTO workout_log_evidence (id,created_at,updated_at,workout_log_id,source,known_metric_fields)
      VALUES ('e','now','now','legacy','manual','["durationMin"]');`)
  return db
}

it('migrates legacy rows without inventing occurrence times or cascading evidence; preserves seconds and replay', () => {
  const db = legacyDatabase()
  try {
    db.pragma('foreign_keys = ON')
    migrateRealizedTrainingTimingSqlite(db)
    assert.deepEqual(db.prepare('select date,duration_min,performed_at,logged_at from workout_logs').get(), {
      date:'2026-09-12', duration_min:45, performed_at:null, logged_at:'2026-09-13T12:00:00Z',
    })
    assert.equal((db.prepare('select count(*) n from workout_log_evidence').get() as {n:number}).n, 1)
    assert.equal(db.pragma('foreign_keys', {simple:true}), 1)
    assert.deepEqual(db.pragma('foreign_key_check'), [])
    const duration = 61 + 1 / 60
    db.prepare('update workout_logs set duration_min = ?, performed_at = ?').run(duration,'2026-09-12T11:00:00Z')
    migrateRealizedTrainingTimingSqlite(db)
    assert.equal((db.prepare('select duration_min from workout_logs').get() as {duration_min:number}).duration_min,duration)
  } finally { db.close() }
})

it('rolls back a table rebuild if referential integrity fails and restores foreign keys', () => {
  const db = legacyDatabase()
  try {
    db.pragma('foreign_keys = OFF')
    db.exec("UPDATE workout_logs SET athlete_id = 'missing'")
    db.pragma('foreign_keys = ON')
    assert.throws(()=>migrateRealizedTrainingTimingSqlite(db), /integrity/)
    assert.equal(db.pragma('foreign_keys',{simple:true}),1)
    assert.equal((db.pragma('table_info(workout_logs)') as {name:string}[]).some(c=>c.name==='performed_at'),false)
    assert.equal((db.prepare('select count(*) n from workout_log_evidence').get() as {n:number}).n,1)
  } finally { db.close() }
})
