import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { test } from 'node:test'

import { validateGeneratedMicrocycleLineageSqlite } from '@/lib/session-generation/review-snapshot-microcycle-lineage-sqlite'

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY NOT NULL, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY NOT NULL, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY NOT NULL, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    INSERT INTO group_training_plans VALUES ('base',0),('variant',0),('foreign',0);
    INSERT INTO macrocycles VALUES ('macro-base','base',0),('macro-variant','variant',0),('macro-foreign','foreign',0);
    INSERT INTO mesocycles VALUES ('meso-base','macro-base',0),('meso-variant','macro-variant',0),('meso-foreign','macro-foreign',0);
    INSERT INTO microcycles VALUES ('week-base','meso-base',0),('week-variant','meso-variant',0),('week-foreign','meso-foreign',0);
  `)
  const state = () => ({
    plans: sqlite.prepare('SELECT * FROM group_training_plans ORDER BY id').all(),
    macros: sqlite.prepare('SELECT * FROM macrocycles ORDER BY id').all(),
    mesos: sqlite.prepare('SELECT * FROM mesocycles ORDER BY id').all(),
    micros: sqlite.prepare('SELECT * FROM microcycles ORDER BY id').all(),
  })
  return { sqlite, state }
}

test('KAN-790 T5.3 each Base and Variant review accepts only its own persisted microcycles', () => {
  const f = fixture()
  try {
    const before = f.state()
    assert.equal(validateGeneratedMicrocycleLineageSqlite(f.sqlite, {
      groupTrainingPlanId: 'base', microcycleIds: ['week-base'],
    }), true)
    assert.equal(validateGeneratedMicrocycleLineageSqlite(f.sqlite, {
      groupTrainingPlanId: 'variant', microcycleIds: ['week-variant'],
    }), true)
    assert.equal(validateGeneratedMicrocycleLineageSqlite(f.sqlite, {
      groupTrainingPlanId: 'base', microcycleIds: ['week-variant'],
    }), false, 'A Variant microcycle is not Base lineage even within the same Sporting Group')
    assert.equal(validateGeneratedMicrocycleLineageSqlite(f.sqlite, {
      groupTrainingPlanId: 'variant', microcycleIds: ['week-base'],
    }), false)
    assert.deepEqual(f.state(), before)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 rejects foreign, missing and deleted lineage without writing', () => {
  const f = fixture()
  try {
    f.sqlite.prepare("UPDATE microcycles SET is_deleted = 1 WHERE id = 'week-base'").run()
    const before = f.state()
    for (const ids of [['week-base'], ['missing'], ['week-foreign'], ['week-variant','week-foreign']]) {
      assert.equal(validateGeneratedMicrocycleLineageSqlite(f.sqlite, {
        groupTrainingPlanId: 'base', microcycleIds: ids,
      }), false)
    }
    assert.deepEqual(f.state(), before)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 rejects a deleted ancestor in Plan to microcycle lineage', () => {
  const f = fixture()
  try {
    f.sqlite.prepare("UPDATE macrocycles SET is_deleted = 1 WHERE id = 'macro-base'").run()
    assert.equal(validateGeneratedMicrocycleLineageSqlite(f.sqlite, {
      groupTrainingPlanId: 'base', microcycleIds: ['week-base'],
    }), false)
  } finally { f.sqlite.close() }
})
