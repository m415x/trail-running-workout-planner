import { config } from 'dotenv'
import postgres from 'postgres'

config({ path: '.env.local' })

const applicationTables = [
  'athlete_groups', 'athlete_profiles', 'competition_entries', 'competition_entry_race_courses',
  'group_history_records', 'group_session_prescriptions', 'group_training_plans',
  'macrocycles', 'intensity_strategies', 'load_strategies', 'memberships', 'mesocycles', 'microcycles',
  'team_economic_policies', 'athlete_billing_terms', 'monthly_charges',
  'microcycle_intensity_targets', 'physiology_records', 'field_performance_test_events', 'field_performance_tests',
  'planning_cohort_memberships', 'planning_cohorts', 'planning_modification_records',
  'race_courses', 'race_editions', 'race_events', 'race_registrations',
  'readiness_evaluations', 'readiness_reviews',
  'session_generation_modification_records', 'sessions', 'shoes', 'teams',
  'training_goal_race_courses', 'training_goals', 'training_locations', 'users',
  'workout_log_corrections', 'workout_log_evidence', 'workout_logs', 'workouts',
]

async function main() {
  const connectionString = process.env.SUPABASE_DIRECT_URL
  if (!connectionString) throw new Error('SUPABASE_DIRECT_URL is not configured')

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
    const fieldTestLifecycleColumns = await sql<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'field_performance_tests'
        and column_name in ('test_event_id', 'execution_context', 'recorded_by', 'recorded_by_user_id', 'review_status')
    `
    const expectedFieldTestLifecycleColumns = ['test_event_id', 'execution_context', 'recorded_by', 'recorded_by_user_id', 'review_status']
    const fieldTestLifecycleValid = expectedFieldTestLifecycleColumns.every(name => {
      const column = fieldTestLifecycleColumns.find(candidate => candidate.column_name === name)
      return column?.data_type === 'text' && column.is_nullable === 'YES' && column.column_default === null
    })
    console.log(`Field performance lifecycle columns: ${fieldTestLifecycleValid ? 'OK' : 'FAIL'}`)

    // KAN-412: check the deployed contract, not only the local migration journal.
    const intensityColumns = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('microcycle_intensity_targets', 'group_session_prescriptions', 'workouts')
        and column_name in (
          'reference_percentage_target', 'pam_percentage_target',
          'reference_percentage', 'pam_percentage'
        )
    `
    const requiredIntensityColumns = [
      'microcycle_intensity_targets:reference_percentage_target',
      'group_session_prescriptions:reference_percentage',
      'workouts:reference_percentage',
    ]
    const presentIntensityColumns = new Set(
      intensityColumns.map(column => `${column.table_name}:${column.column_name}`),
    )
    const missingIntensityColumns = requiredIntensityColumns.filter(
      column => !presentIntensityColumns.has(column),
    )
    const legacyIntensityColumns = intensityColumns
      .filter(column => column.column_name.startsWith('pam_percentage'))
      .map(column => `${column.table_name}.${column.column_name}`)

    const legacyIntensityMethods = await sql<{ source: string; count: number }[]>`
      select 'intensity_strategies.default_method' as source, count(*)::integer as count
      from intensity_strategies where default_method = 'pam_percentage'
      union all
      select 'group_session_prescriptions.intensity_method', count(*)::integer
      from group_session_prescriptions where intensity_method = 'pam_percentage'
      union all
      select 'workouts.intensity_method', count(*)::integer
      from workouts where intensity_method = 'pam_percentage'
      union all
      select 'microcycle_intensity_targets.field_sources', count(*)::integer
      from microcycle_intensity_targets
      where field_sources::text like '%"pamPercentageTarget"%'
    `
    const remainingLegacyMethods = legacyIntensityMethods.filter(entry => entry.count > 0)
    const intensityContractValid = missingIntensityColumns.length === 0
      && legacyIntensityColumns.length === 0
      && remainingLegacyMethods.length === 0
    console.log(`Reference percentage contract: ${intensityContractValid ? 'OK' : 'FAIL'}`)
    if (missingIntensityColumns.length > 0) {
      console.log(`Missing canonical intensity columns: ${missingIntensityColumns.join(', ')}`)
    }
    if (legacyIntensityColumns.length > 0) {
      console.log(`Legacy intensity columns: ${legacyIntensityColumns.join(', ')}`)
    }
    if (remainingLegacyMethods.length > 0) {
      console.log(`Legacy intensity values: ${remainingLegacyMethods.map(entry => `${entry.source} (${entry.count})`).join(', ')}`)
    }

    const billingConstraints = await sql<{ constraint_name: string; constraint_type: string }[]>\`
      select tc.constraint_name, tc.constraint_type
      from information_schema.table_constraints tc
      where tc.table_schema = 'public'
        and tc.table_name = 'monthly_charges'
        and tc.constraint_type in ('UNIQUE', 'FOREIGN KEY')
    \`
    const billingIndexes = await sql<{ indexname: string }[]>\`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'monthly_charges'
    \`
    const billingForeignKeys = await sql<{ column_name: string; foreign_table_name: string; foreign_column_name: string }[]>\`
      select
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.constraint_schema = kcu.constraint_schema
      join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name
       and tc.constraint_schema = ccu.constraint_schema
      where tc.table_schema = 'public'
        and tc.table_name = 'monthly_charges'
        and tc.constraint_type = 'FOREIGN KEY'
    \`
    const monthlyChargeUnique = billingIndexes.some(
      index => index.indexname === 'monthly_charges_athlete_year_month_unique',
    )
    const billingTermsForeignKey = billingForeignKeys.some(
      foreignKey => foreignKey.column_name === 'billing_terms_id'
        && foreignKey.foreign_table_name === 'athlete_billing_terms'
        && foreignKey.foreign_column_name === 'id',
    )
    const billingContractValid = monthlyChargeUnique && billingTermsForeignKey
      && billingConstraints.some(constraint => constraint.constraint_type === 'FOREIGN KEY')
    console.log(\`H1 billing persistence contract: \${billingContractValid ? 'OK' : 'FAIL'}\`)

    const occurrence = timingColumns.find(column => column.column_name === 'performed_at')
    const duration = timingColumns.find(column => column.column_name === 'duration_min')
    const timingValid = occurrence?.data_type === 'text' && occurrence.is_nullable === 'YES'
      && occurrence.column_default === null && duration?.data_type === 'double precision'
      && ['date', 'logged_at'].every(name => timingColumns.some(column => column.column_name === name && column.is_nullable === 'NO'))
    console.log(`Workout log timing columns: ${timingValid ? 'OK' : 'FAIL'}`)

    console.log(`Application tables: ${tables.length}/${applicationTables.length}`)
    console.log(`Tables with RLS: ${protectedTables.length}/${applicationTables.length}`)
    if (missingTables.length > 0) {
      console.log(`Missing tables: ${missingTables.join(', ')}`)
    }
    if (unprotectedTables.length > 0) {
      console.log(`Tables without RLS: ${unprotectedTables.join(', ')}`)
    }

    if (missingTables.length > 0 || unprotectedTables.length > 0 || !timingValid || !fieldTestLifecycleValid || !intensityContractValid || !billingContractValid) {
      process.exitCode = 1
    }
  } finally {
    await sql.end()
  }
}

void main()
