import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSqliteSchemaSql } from '../../scripts/verify-sqlite-scenarios'

test('KAN-732 drift treats equivalent qualified CHECK columns identically', () => {
  const fresh = "CREATE TABLE `field_performance_test_events` (`protocol` text NOT NULL, CONSTRAINT `field_performance_test_events_protocol_check` CHECK (`field_performance_test_events`.`protocol` = '1000m_track'))"
  const upgraded = "CREATE TABLE `field_performance_test_events` (`protocol` text NOT NULL, CONSTRAINT `field_performance_test_events_protocol_check` CHECK (`protocol` = '1000m_track'))"
  assert.equal(normalizeSqliteSchemaSql(fresh), normalizeSqliteSchemaSql(upgraded))
  const different = upgraded.replace("'1000m_track'", "'different_protocol'")
  assert.notEqual(normalizeSqliteSchemaSql(fresh), normalizeSqliteSchemaSql(different))
})
