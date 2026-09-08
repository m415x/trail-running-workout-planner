import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { workouts } from '@/db/schema'
import type { db as ApplicationDatabase } from '@/db'
import {
  createWorkoutTemplateRecord,
  duplicateWorkoutTemplateRecord,
  setWorkoutTemplateArchiveStatusRecord,
  updateWorkoutTemplateRecord,
  type WorkoutTemplatePersistenceValues,
} from '@/lib/workout-templates/workout-template-persistence'

const ORIGINAL_VALUES: WorkoutTemplatePersistenceValues = {
  teamId: 'team-1',
  category: 'quality',
  tags: ['fartlek', 'pam'],
  title: 'Fartlek piramidal',
  type: 'Fartlek',
  distance: 10,
  time: 60,
  gain: 150,
  intensityMethod: 'pam_percentage',
  zone: null,
  pamPercentage: 100,
  pace: null,
  notes: 'Controlar la técnica.',
  prescriptionNotes: 'Recuperación al trote.',
  trackPath: null,
  locationKey: null,
  structure: { warmup: '15 minutos', mainBlock: '1-2-3-2-1 minutos' },
}

describe('persistencia de plantillas de sesión', () => {
  let sqlite: Database.Database
  let database: typeof ApplicationDatabase

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE workouts (
        id TEXT PRIMARY KEY,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        team_id TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        archived_at TEXT,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        distance REAL,
        time INTEGER,
        gain INTEGER,
        intensity_method TEXT,
        zone TEXT,
        pam_percentage REAL,
        pace INTEGER,
        notes TEXT,
        prescription_notes TEXT,
        track_path TEXT,
        location_key TEXT,
        structure TEXT
      )
    `)
    database = drizzle(sqlite, { schema: { workouts } }) as unknown as typeof ApplicationDatabase
  })

  afterEach(() => sqlite.close())

  it('crea y edita una plantilla sin cambiar su identidad ni duplicar filas', () => {
    createWorkoutTemplateRecord({
      id: 'template-1',
      values: ORIGINAL_VALUES,
      now: '2026-09-01T10:00:00.000Z',
      database,
    })

    const changed = updateWorkoutTemplateRecord({
      id: 'template-1',
      teamId: 'team-1',
      values: { ...ORIGINAL_VALUES, title: 'Fartlek progresivo', distance: 12 },
      now: '2026-09-02T10:00:00.000Z',
      database,
    })
    const rows = database.select().from(workouts).all()

    assert.equal(changed, true)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 'template-1')
    assert.equal(rows[0].title, 'Fartlek progresivo')
    assert.equal(rows[0].distance, 12)
    assert.equal(rows[0].createdAt, '2026-09-01T10:00:00.000Z')
    assert.equal(rows[0].updatedAt, '2026-09-02T10:00:00.000Z')
  })

  it('duplica todos los valores como una copia activa e independiente', () => {
    createWorkoutTemplateRecord({ id: 'source', values: ORIGINAL_VALUES, database })
    assert.equal(duplicateWorkoutTemplateRecord({
      sourceId: 'source',
      duplicateId: 'copy',
      teamId: 'team-1',
      titlePrefix: 'Copia de',
      database,
    }), true)

    updateWorkoutTemplateRecord({
      id: 'source',
      teamId: 'team-1',
      values: { ...ORIGINAL_VALUES, distance: 18 },
      database,
    })
    const source = database.select().from(workouts).where(eq(workouts.id, 'source')).get()
    const copy = database.select().from(workouts).where(eq(workouts.id, 'copy')).get()

    assert.equal(source?.distance, 18)
    assert.equal(copy?.distance, 10)
    assert.equal(copy?.title, 'Copia de Fartlek piramidal')
    assert.equal(copy?.archivedAt, null)
    assert.equal(copy?.isDeleted, false)
    assert.deepEqual(copy?.tags, ['fartlek', 'pam'])
    assert.deepEqual(copy?.structure, ORIGINAL_VALUES.structure)
  })

  it('archiva y reactiva sin borrar ni alterar el contenido', () => {
    createWorkoutTemplateRecord({ id: 'template-1', values: ORIGINAL_VALUES, database })

    assert.equal(setWorkoutTemplateArchiveStatusRecord({
      id: 'template-1',
      teamId: 'team-1',
      archived: true,
      now: '2026-09-03T10:00:00.000Z',
      database,
    }), true)
    let row = database.select().from(workouts).where(eq(workouts.id, 'template-1')).get()
    assert.equal(row?.archivedAt, '2026-09-03T10:00:00.000Z')
    assert.equal(row?.title, ORIGINAL_VALUES.title)
    assert.equal(row?.isDeleted, false)

    assert.equal(setWorkoutTemplateArchiveStatusRecord({
      id: 'template-1',
      teamId: 'team-1',
      archived: false,
      now: '2026-09-04T10:00:00.000Z',
      database,
    }), true)
    row = database.select().from(workouts).where(eq(workouts.id, 'template-1')).get()
    assert.equal(row?.archivedAt, null)
    assert.equal(row?.title, ORIGINAL_VALUES.title)
  })

  it('impide modificar, duplicar o archivar plantillas de otro equipo', () => {
    createWorkoutTemplateRecord({ id: 'template-1', values: ORIGINAL_VALUES, database })

    assert.equal(updateWorkoutTemplateRecord({
      id: 'template-1',
      teamId: 'team-2',
      values: { ...ORIGINAL_VALUES, teamId: 'team-2', title: 'Intrusión' },
      database,
    }), false)
    assert.equal(duplicateWorkoutTemplateRecord({
      sourceId: 'template-1',
      duplicateId: 'copy',
      teamId: 'team-2',
      titlePrefix: 'Copia de',
      database,
    }), false)
    assert.equal(setWorkoutTemplateArchiveStatusRecord({
      id: 'template-1',
      teamId: 'team-2',
      archived: true,
      database,
    }), false)

    const rows = database.select().from(workouts).all()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].title, ORIGINAL_VALUES.title)
    assert.equal(rows[0].archivedAt, null)
  })
})
