import { config } from 'dotenv'
import postgres from 'postgres'

config({ path: '.env.local' })

const applicationTables = [
  'athlete_groups', 'athlete_profiles', 'competition_entries', 'competition_entry_race_courses',
  'group_history_records', 'group_session_prescriptions', 'group_training_plans',
  'macrocycles', 'intensity_strategies', 'load_strategies', 'memberships', 'mesocycles', 'microcycles',
  'microcycle_intensity_targets', 'physiology_records',
  'planning_cohort_memberships', 'planning_cohorts', 'planning_modification_records',
  'race_courses', 'race_editions', 'race_events',
  'readiness_evaluations', 'readiness_reviews',
  'session_generation_modification_records', 'sessions', 'shoes', 'teams',
  'training_goal_race_courses', 'training_goals', 'training_locations', 'users',
  'workout_log_corrections', 'workout_log_evidence', 'workout_logs', 'workouts',
]

async function main() {
  const connectionString = process.env.SUPABASE_DIRECT_URL
  if (!connectionString) throw new Error('SUPABASE_DIRECT_URL no está configurada')

  const sql = postgres(connectionString, { prepare: false, max: 1 })

  try {
    const tables = await sql<{ tableName: string; rlsEnabled: boolean }[]>`
      select c.relname as "tableName", c.relrowsecurity as "rlsEnabled"
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname in ${sql(applicationTables)}
    `
    const found = new Set(tables.map(({ tableName }) => tableName))
    const missingTables = applicationTables.filter((table) => !found.has(table))
    const unprotectedTables = tables
      .filter(({ rlsEnabled }) => !rlsEnabled)
      .map(({ tableName }) => tableName)
      .sort()
    const protectedTables = tables.filter((table) => table.rlsEnabled)

    const timingColumns = await sql<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'workout_logs'
        and column_name in ('date', 'performed_at', 'logged_at', 'duration_min')
    `
    const occurrence = timingColumns.find(column => column.column_name === 'performed_at')
    const duration = timingColumns.find(column => column.column_name === 'duration_min')
    const timingValid = occurrence?.data_type === 'text' && occurrence.is_nullable === 'YES'
      && occurrence.column_default === null && duration?.data_type === 'double precision'
      && ['date', 'logged_at'].every(name => timingColumns.some(column => column.column_name === name && column.is_nullable === 'NO'))
    console.log(`Workout log timing columns: ${timingValid ? 'OK' : 'FAIL'}`)

    console.log(`Tablas de aplicación: ${tables.length}/${applicationTables.length}`)
    console.log(`Tablas con RLS: ${protectedTables.length}/${applicationTables.length}`)
    if (missingTables.length > 0) {
      console.log(`Tablas faltantes: ${missingTables.join(', ')}`)
    }
    if (unprotectedTables.length > 0) {
      console.log(`Tablas sin RLS: ${unprotectedTables.join(', ')}`)
    }

    if (missingTables.length > 0 || unprotectedTables.length > 0 || !timingValid) {
      process.exitCode = 1
    }
  } finally {
    await sql.end()
  }
}

void main()
