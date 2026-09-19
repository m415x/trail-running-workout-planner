import assert from 'node:assert/strict'
import test from 'node:test'

import { getTableConfig } from 'drizzle-orm/sqlite-core'

import { fieldPerformanceTests } from '@/db/schema'

test('field performance tests persist only canonical observed 1000 m evidence', () => {
  const config = getTableConfig(fieldPerformanceTests)
  const columns = config.columns.map((column) => column.name)

  assert.equal(config.name, 'field_performance_tests')
  assert.deepEqual(columns, [
    'id', 'is_deleted', 'created_at', 'updated_at', 'athlete_id',
    'performed_at', 'protocol', 'distance_m', 'elapsed_time_sec', 'notes',
  ])

  assert.equal(columns.includes('pace_sec_per_km'), false)
  assert.equal(columns.includes('average_speed_kmh'), false)
  assert.equal(columns.some((column) => column.includes('pam')), false)
  assert.equal(columns.some((column) => column.includes('hr')), false)
})

test('field performance tests keep protocol and distance as explicit constrained evidence', () => {
  const config = getTableConfig(fieldPerformanceTests)

  assert.equal(config.checks.some((check) => check.name === 'field_performance_tests_protocol_check'), true)
  assert.equal(config.checks.some((check) => check.name === 'field_performance_tests_distance_check'), true)
  assert.equal(config.checks.some((check) => check.name === 'field_performance_tests_elapsed_time_check'), true)
})

test('field performance tests are append-oriented and indexed by athlete/date', () => {
  const config = getTableConfig(fieldPerformanceTests)

  assert.equal(config.indexes.some((index) => index.config.name === 'field_performance_tests_athlete_date_idx'), true)
  assert.equal(config.uniqueConstraints.length, 0)
  assert.equal(config.indexes.some((index) => index.config.unique), false)
})

test('field performance tests reuse soft-delete lifecycle for safe invalidation', () => {
  const config = getTableConfig(fieldPerformanceTests)
  const isDeleted = config.columns.find((column) => column.name === 'is_deleted')

  assert.ok(isDeleted)
  assert.equal(isDeleted.notNull, true)
  assert.equal(isDeleted.default, false)
})
