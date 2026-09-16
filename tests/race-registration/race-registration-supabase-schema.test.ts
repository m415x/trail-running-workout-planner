import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getTableConfig } from 'drizzle-orm/pg-core'

import { raceRegistrations } from '@/db/supabase/race-registration-schema'

const config = () => getTableConfig(raceRegistrations)

describe('race registration Supabase schema', () => {
  it('persists the same durable factual columns as SQLite', () => {
    const columnNames = config().columns.map((column) => column.name)

    for (const required of [
      'id', 'team_id', 'athlete_profile_id',
      'race_event_id', 'race_edition_id', 'race_course_id',
      'registration_status', 'participation_status',
      'snapshot_event_name', 'snapshot_edition_label', 'snapshot_edition_date',
      'snapshot_course_label', 'snapshot_nominal_distance_km',
      'snapshot_nominal_elevation_gain_m', 'result_actual_distance_km',
      'result_elapsed_time_seconds',
    ]) assert.ok(columnNames.includes(required), `missing durable column ${required}`)
  })

  it('enforces team + athlete + edition uniqueness independently from course', () => {
    const uniqueness = config().indexes.find(
      (index) => index.config.unique && index.config.name === 'race_registrations_team_athlete_edition_unique',
    )

    assert.ok(uniqueness)
    assert.deepEqual(
      uniqueness.config.columns.map((column) => 'name' in column ? column.name : null),
      ['team_id', 'athlete_profile_id', 'race_edition_id'],
    )
  })

  it('references the concrete catalog event, edition and course hierarchy', () => {
    const referencedTables = config().foreignKeys.map(
      (foreignKey) => foreignKey.reference().foreignTable[Symbol.for('drizzle:Name')],
    )

    assert.ok(referencedTables.includes('race_events'))
    assert.ok(referencedTables.includes('race_editions'))
    assert.ok(referencedTables.includes('race_courses'))
  })

  it('constrains lifecycle values with the same structural checks as SQLite', () => {
    const checks = config().checks.map((check) => check.name)

    assert.ok(checks.includes('race_registrations_registration_status_check'))
    assert.ok(checks.includes('race_registrations_participation_status_check'))
  })
})
