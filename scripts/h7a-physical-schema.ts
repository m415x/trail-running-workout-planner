import type Database from 'better-sqlite3'

/**
 * Read-only physical audit of the H7A 0020–0025 schema.
 * This does not infer migration application from journal timestamps and never repairs data.
 */
type Column = { name: string; type: string; notnull: number; pk: number; dflt_value: string | null }
type ForeignKey = { from: string; table: string; to: string; on_delete: string; on_update: string }
type Index = { name: string; unique: number }
type IndexColumn = { name: string }

const authors = [
  ['team_economic_policies', 'created_by_user_id'],
  ['athlete_billing_terms', 'created_by_user_id'],
  ['global_monthly_due_date_exceptions', 'created_by_user_id'],
  ['monthly_charge_reductions', 'created_by_user_id'],
  ['monthly_charge_extensions', 'created_by_user_id'],
  ['payment_revisions', 'created_by_user_id'],
  ['field_performance_tests', 'reviewed_by_user_id'],
  ['field_performance_test_events', 'created_by_user_id'],
] as const

const eventColumns = [
  ['id', 'TEXT', 1], ['is_deleted', 'INTEGER', 1],
  ['created_at', 'TEXT', 1], ['updated_at', 'TEXT', 1],
  ['team_id', 'TEXT', 1], ['group_id', 'TEXT', 1],
  ['scheduled_at', 'TEXT', 1], ['protocol', 'TEXT', 1],
  ['created_by_user_id', 'TEXT', 0],
] as const

function quoted(identifier: string): string {
  return '"' + identifier.replaceAll('"', '""') + '"'
}

export function auditH7aPhysicalSchema(db: Database.Database): string[] {
  const failures: string[] = []
  const tables = new Set((db.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table'",
  ).all() as Array<{ name: string }>).map(row => row.name))

  for (const [table, author] of authors) {
    if (!tables.has(table)) {
      failures.push(`H7A missing table ${table}`)
      continue
    }

    const columns = db.pragma(`table_xinfo(${quoted(table)})`) as Column[]
    const column = columns.find(item => item.name === author)
    if (!column) {
      failures.push(`H7A missing column ${table}.${author}`)
    } else if (column.type.toUpperCase() !== 'TEXT' || column.notnull !== 0) {
      failures.push(`H7A incompatible nullable TEXT column ${table}.${author}`)
    }

    const foreignKeys = db.pragma(`foreign_key_list(${quoted(table)})`) as ForeignKey[]
    const authorKeys = foreignKeys.filter(key => key.from === author)
    if (authorKeys.length !== 1 ||
        authorKeys[0].table !== 'users' ||
        authorKeys[0].to !== 'id' ||
        authorKeys[0].on_delete.toUpperCase() !== 'RESTRICT' ||
        authorKeys[0].on_update.toUpperCase() !== 'NO ACTION') {
      failures.push(`H7A invalid FK ${table}.${author}: expected users(id) ON DELETE RESTRICT`)
    }
  }

  if (tables.has('field_performance_test_events')) {
    const table = 'field_performance_test_events'
    const columns = db.pragma(`table_xinfo("${table}")`) as Column[]
    if (columns.length !== eventColumns.length) {
      failures.push('H7A 0025 field_performance_test_events column count differs')
    }
    for (const [name, type, required] of eventColumns) {
      const column = columns.find(item => item.name === name)
      if (!column || column.type.toUpperCase() !== type || column.notnull !== required) {
        failures.push(`H7A 0025 incompatible ${table}.${name}`)
      }
    }
    if (columns.find(item => item.name === 'id')?.pk !== 1) {
      failures.push('H7A 0025 field_performance_test_events.id must be primary key')
    }
    const keys = db.pragma(`foreign_key_list("${table}")`) as ForeignKey[]
    for (const [name, target, deletion] of [
      ['team_id', 'teams', 'CASCADE'],
      ['group_id', 'athlete_groups', 'RESTRICT'],
    ]) {
      if (!keys.some(key => key.from === name && key.table === target && key.to === 'id' &&
          key.on_delete.toUpperCase() === deletion && key.on_update.toUpperCase() === 'NO ACTION')) {
        failures.push(`H7A 0025 invalid FK ${table}.${name}`)
      }
    }
    const sql = (db.prepare(
      "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
    ).get(table) as { sql?: string } | undefined)?.sql ?? ''
    if (!/CHECK\s*\(\s*["'`]?protocol["'`]?\s*=\s*'1000m_track'\s*\)/i.test(sql)) {
      failures.push('H7A 0025 missing protocol CHECK')
    }
    const indexes = db.pragma(`index_list("${table}")`) as Index[]
    const index = indexes.find(value => value.name === 'field_performance_test_events_team_group_date_idx')
    if (!index || index.unique !== 0) {
      failures.push('H7A 0025 missing non-unique team/group/date index')
    } else {
      const indexed = db.pragma(`index_info("${index.name}")`) as IndexColumn[]
      if (indexed.map(value => value.name).join(',') !== 'team_id,group_id,scheduled_at') {
        failures.push('H7A 0025 wrong team/group/date index columns')
      }
    }
  }

  return failures
}
