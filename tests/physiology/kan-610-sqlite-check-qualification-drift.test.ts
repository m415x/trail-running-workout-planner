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

test('KAN-732 drift canonicalizes SQLite double-quoted identifiers after dot qualification', () => {
  const fresh = "CREATE TABLE `field_performance_test_events` (`protocol` text NOT NULL, CONSTRAINT `field_performance_test_events_protocol_check` CHECK (`field_performance_test_events` .\"protocol\" = '1000m_track'))"
  const upgraded = "CREATE TABLE `field_performance_test_events` (`protocol` text NOT NULL, CONSTRAINT `field_performance_test_events_protocol_check` CHECK (`protocol` = '1000m_track'))"
  assert.equal(normalizeSqliteSchemaSql(fresh), normalizeSqliteSchemaSql(upgraded))
  assert.notEqual(normalizeSqliteSchemaSql(fresh), normalizeSqliteSchemaSql(upgraded.replace("'1000m_track'", "'other'")))
})

test('KAN-732 drift canonicalizes FK action keyword case without hiding action differences', () => {
  const fresh = "CREATE TABLE `field_performance_test_events` (`created_by_user_id` text, FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE restrict)"
  const upgraded = fresh.replace('ON DELETE restrict', 'ON DELETE RESTRICT')
  assert.equal(normalizeSqliteSchemaSql(fresh), normalizeSqliteSchemaSql(upgraded))
  assert.notEqual(normalizeSqliteSchemaSql(fresh), normalizeSqliteSchemaSql(fresh.replace('ON DELETE restrict', 'ON DELETE cascade')))
})
