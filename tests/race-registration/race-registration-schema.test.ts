import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getTableConfig } from 'drizzle-orm/sqlite-core'

import { raceRegistrations } from '@/db/race-registration-schema'

const config = () => getTableConfig(raceRegistrations)

describe('race registration SQLite schema', () => {
  it('persists registration, participation, historical snapshot and factual result columns', () => {
    const columnNames = config().columns.map((column) => column.name)

    for (const required of [
      'id',
      'team_id',
      'athlete_profile_id',
      'race_event_id',
      'race_edition_id',
      'race_course_id',
      'registration_status',
      'participation_status',
      'snapshot_event_name',
      'snapshot_edition_label',
      'snapshot_edition_date',
      'snapshot_course_label',
      'snapshot_nominal_distance_km',
      'snapshot_nominal_elevation_gain_m',
      'result_actual_distance_km',
      'result_elapsed_time_seconds',
    ]) {
      assert.ok(columnNames.includes(required), `missing durable column ${required}`)
    }
  })

  it('enforces team + athlete + edition uniqueness independently from course', () => {
    const uniqueIndexes = config().indexes.filter((index) => index.config.unique)
    const uniqueness = uniqueIndexes.find(
      (index) => index.config.name === 'race_registrations_team_athlete_edition_unique',
    )

    assert.ok(uniqueness, 'expected edition-level registration uniqueness index')
    assert.deepEqual(
      uniqueness.config.columns.map((column) => 'name' in column ? column.name : null),
      ['team_id', 'athlete_profile_id', 'race_edition_id'],
    )
  })

  it('keeps concrete catalog foreign keys for event, edition and course', () => {
    const foreignKeys = config().foreignKeys
    const referencedTables = foreignKeys.map((foreignKey) => foreignKey.reference().foreignTable[Symbol.for('drizzle:Name')])

    assert.ok(referencedTables.includes('race_events'))
    assert.ok(referencedTables.includes('race_editions'))
    assert.ok(referencedTables.includes('race_courses'))
  })

  it('constrains registration and participation lifecycle values structurally', () => {
    const checkNames = config().checks.map((check) => check.name)

    assert.ok(checkNames.includes('race_registrations_registration_status_check'))
    assert.ok(checkNames.includes('race_registrations_participation_status_check'))
  })
})
