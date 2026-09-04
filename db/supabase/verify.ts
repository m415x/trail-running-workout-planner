import { config } from 'dotenv'
import postgres from 'postgres'

config({ path: '.env.local' })

const applicationTables = [
  'athlete_groups', 'athlete_profiles', 'group_history_records',
  'group_session_prescriptions', 'group_training_plans', 'macrocycles',
  'load_strategies', 'memberships', 'mesocycles', 'microcycles', 'physiology_records',
  'planning_modification_records', 'sessions', 'shoes', 'teams',
  'training_goals', 'training_locations', 'users', 'workout_logs', 'workouts',
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
  const protectedTables = tables.filter((table) => table.rlsEnabled)

  console.log(`Tablas de aplicación: ${tables.length}/${applicationTables.length}`)
  console.log(`Tablas con RLS: ${protectedTables.length}/${applicationTables.length}`)

  if (tables.length !== applicationTables.length || protectedTables.length !== applicationTables.length) {
    process.exitCode = 1
  }
  } finally {
    await sql.end()
  }
}

void main()
