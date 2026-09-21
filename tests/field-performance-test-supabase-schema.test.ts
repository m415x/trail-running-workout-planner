import assert from 'node:assert/strict'
import test from 'node:test'

import { getTableConfig } from 'drizzle-orm/pg-core'

import { fieldPerformanceTests } from '@/db/supabase/field-performance-test-schema'

test('Supabase schema mirrors canonical 1000m observed evidence without derived physiology', () => {
  const config = getTableConfig(fieldPerformanceTests)
  assert.equal(config.name, 'field_performance_tests')
  assert.deepEqual(
    config.columns.map((column) => column.name),
    ['id', 'is_deleted', 'created_at', 'updated_at', 'athlete_id', 'performed_at', 'protocol', 'source', 'test_event_id', 'execution_context', 'recorded_by', 'recorded_by_user_id', 'review_status', 'distance_m', 'elapsed_time_sec', 'notes'],
  )
  assert.equal(config.columns.find((column) => column.name === 'athlete_id')?.notNull, true)
  assert.equal(config.columns.find((column) => column.name === 'elapsed_time_sec')?.notNull, true)
  assert.equal(config.columns.find((column) => column.name === 'source')?.notNull, true)
  assert.equal(config.indexes.some((index) => index.config.name === 'field_performance_tests_athlete_date_idx'), true)
  assert.equal(config.checks.some((check) => check.name === 'field_performance_tests_protocol_check'), true)
  assert.equal(config.checks.some((check) => check.name === 'field_performance_tests_source_check'), true)
  assert.equal(config.checks.some((check) => check.name === 'field_performance_tests_distance_check'), true)
  assert.equal(config.checks.some((check) => check.name === 'field_performance_tests_elapsed_time_check'), true)
  for (const forbidden of ['pace', 'speed', 'pam', 'max_hr', 'rest_hr', 'threshold']) {
    assert.equal(config.columns.some((column) => column.name.includes(forbidden)), false)
  }
})
