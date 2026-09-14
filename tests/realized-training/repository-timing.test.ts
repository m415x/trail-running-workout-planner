import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import Database from 'better-sqlite3'
import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

it('round-trips actual timing through the durable repository and rolls back a rejected sidecar', async () => {
  const originalDirectory = process.cwd()
  const directory = mkdtempSync(join(tmpdir(), 'kan290-'))
  const sqlite = new Database(join(directory, 'sqlite.db'))
  let closeRepository: (() => void) | undefined
  try {
    sqlite.exec(readFileSync('drizzle/sqlite/0000_baseline.sql','utf8'))
    migrateRealizedTrainingTimingSqlite(sqlite)
    sqlite.exec(`INSERT INTO teams (id,created_at,updated_at,name) VALUES ('t','now','now','Team');
      INSERT INTO users (id,created_at,updated_at,user_name,email,first_name,last_name)
        VALUES ('u','now','now','user','u@example.test','Test','User');
      INSERT INTO athlete_profiles (id,created_at,updated_at,user_id,team_id,dni)
        VALUES ('a','now','now','u','t','test');`)
    process.chdir(directory)
    const { createManualRealizedTrainingRecord, getRealizedTrainingRecord } = await import('@/lib/realized-training/realized-training-repository')
    const { db } = await import('@/db')
    closeRepository = () => db.$client.close()
    process.chdir(originalDirectory)
    const unknown = {state:'unknown'} as const
    const input: ManualRealizedTrainingCaptureInput = {
      athleteId:'a', sessionId:null, workoutId:null, date:'2026-09-13',
      performedAt:'2026-09-13T23:30:00-03:00', status:'completed',
      metrics:{distanceKm:{state:'known',value:0}, durationMin:{state:'known',value:1/60},
        elevationGainM:unknown, avgHrBpm:unknown, rpe:unknown}, feeling:null, athleteNotes:null,
    }
    const record = createManualRealizedTrainingRecord(input)
    assert.equal(record.performedAt,'2026-09-14T02:30:00.000Z')
    assert.equal(record.date,'2026-09-13')
    assert.notEqual(record.provenance.loggedAt,record.performedAt)
    assert.deepEqual(getRealizedTrainingRecord(record.id)?.metrics.durationMin,{state:'known',value:1/60})
    assert.deepEqual(record.metrics.distanceKm,{state:'known',value:0})
    assert.equal(record.metrics.elevationGainM.state,'unknown')
    assert.equal(record.sessionId,null)
    sqlite.exec(`CREATE TRIGGER reject_evidence BEFORE INSERT ON workout_log_evidence
      BEGIN SELECT RAISE(ABORT, 'test sidecar failure'); END;`)
    assert.throws(()=>createManualRealizedTrainingRecord(input),/sidecar failure/)
    assert.equal((sqlite.prepare('select count(*) n from workout_logs').get() as {n:number}).n,1)
    sqlite.exec('UPDATE workout_logs SET performed_at = NULL; DELETE FROM workout_log_evidence;')
    assert.equal(getRealizedTrainingRecord(record.id)?.performedAt,null)
    assert.equal(getRealizedTrainingRecord(record.id)?.metrics.distanceKm.state,'unknown')
  } finally {
    process.chdir(originalDirectory)
    closeRepository?.()
    sqlite.close()
    // Windows can keep a just-closed SQLite directory briefly locked. Retry the
    // recursive removal instead of turning that filesystem race into a test failure.
    rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100})
  }
})