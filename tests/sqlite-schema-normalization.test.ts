import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeSqliteSchemaSql } from '@/scripts/verify-sqlite-scenarios'

describe('SQLite schema drift normalization', () => {
  it('ignores SQL formatting differences while preserving schema tokens', () => {
    const fresh = 'CREATE TABLE `workouts` (\n  `id` text PRIMARY KEY,\n  `reference_percentage` real\n)'
    const upgraded = 'CREATE TABLE `workouts` (\n\t`id` text PRIMARY KEY,\n\t`reference_percentage` real\n)'
    assert.equal(normalizeSqliteSchemaSql(fresh), normalizeSqliteSchemaSql(upgraded))
    assert.notEqual(
      normalizeSqliteSchemaSql(fresh),
      normalizeSqliteSchemaSql(upgraded.replace('reference_percentage', 'pam_percentage')),
    )
  })

  it('treats double-quoted and backtick identifiers as equivalent', () => {
    assert.equal(
      normalizeSqliteSchemaSql('CREATE TABLE "field_performance_tests" ("id" text PRIMARY KEY)'),
      normalizeSqliteSchemaSql('CREATE TABLE `field_performance_tests` (`id` text PRIMARY KEY)'),
    )
    assert.notEqual(
      normalizeSqliteSchemaSql('CREATE TABLE "field_performance_tests" ("id" text PRIMARY KEY)'),
      normalizeSqliteSchemaSql('CREATE TABLE `field_performance_tests` (`other_id` text PRIMARY KEY)'),
    )
  })

  it('keeps identifiers and SQL keywords intact during tokenization', () => {
    const normalized = normalizeSqliteSchemaSql(
      'CREATE TABLE `athlete_groups` (`is_deleted` integer DEFAULT false NOT NULL)',
    )
    assert.match(normalized ?? '', /`athlete_groups`/)
    assert.match(normalized ?? '', /`is_deleted`/)
    assert.match(normalized ?? '', /DEFAULT false NOT NULL/)
    assert.doesNotMatch(normalized ?? '', /`athlete_group `|`i _deleted`|fal e/)
  })

  it('does not ignore whitespace inside SQL string literals', () => {
    assert.notEqual(
      normalizeSqliteSchemaSql("CREATE TABLE t (value text DEFAULT 'a b')"),
      normalizeSqliteSchemaSql("CREATE TABLE t (value text DEFAULT 'ab')"),
    )
  })
})
