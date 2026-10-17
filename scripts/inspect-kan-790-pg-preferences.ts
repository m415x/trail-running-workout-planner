/**
 * KAN-790/T5.4 — PG-2 read-only physical parity discovery.
 *
 * Restricts execution to the disposable database used by the PG-1/PG-2
 * harness. This diagnostic NEVER migrates, seeds, or mutates data.
 */
import postgres from 'postgres'

async function main(): Promise<void> {
  const url = process.env.KAN789_PG_URL
  if (!url) throw new Error('KAN789_PG_URL required: do not infer absence from a SKIP')
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
    target.pathname !== '/kan789_acceptance') {
    throw new Error('Refusing non-disposable PostgreSQL target')
  }

  const sql = postgres(url, { max: 1, prepare: false })
  try {
    await sql.begin(async tx => {
      await tx`SET TRANSACTION READ ONLY`
      const db = await tx<{ database: string; user_name: string; schema_name: string }[]>`
        SELECT current_database() AS database,
          current_user AS user_name,
          current_schema() AS schema_name`
      if (db[0]?.database !== 'kan789_acceptance') {
        throw new Error('Unexpected PostgreSQL database')
      }
      const relations = await tx<{
        schema_name: string; relation_name: string; kind: string;
        rls_enabled: boolean; rls_forced: boolean
      }[]>`
        SELECT ns.nspname AS schema_name,
          cls.relname AS relation_name,
          cls.relkind::text AS kind,
          cls.relrowsecurity AS rls_enabled,
          cls.relforcerowsecurity AS rls_forced
        FROM pg_class AS cls
        INNER JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public'
          AND cls.relname = 'session_generation_preferences'
        ORDER BY ns.nspname, cls.relname`
      const columns = await tx<{
        column_name: string; type: string; nullable: string; default_expression: string | null
      }[]>`
        SELECT column_name, data_type AS type, is_nullable AS nullable,
          column_default AS default_expression
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'session_generation_preferences'
        ORDER BY ordinal_position`
      const constraints = await tx<{
        name: string; kind: string; definition: string
      }[]>`
        SELECT con.conname AS name, con.contype::text AS kind,
          pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint AS con
        INNER JOIN pg_class AS cls ON cls.oid = con.conrelid
        INNER JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public' AND cls.relname = 'session_generation_preferences'
        ORDER BY con.conname`
      const indexes = await tx<{
        name: string; definition: string
      }[]>`
        SELECT indexname AS name, indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'session_generation_preferences'
        ORDER BY indexname`
      const policies = await tx<{
        policyname: string; roles: string[]; cmd: string; qual: string | null;
        with_check: string | null
      }[]>`
        SELECT policyname, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'session_generation_preferences'
        ORDER BY policyname`
      const permissions = await tx<{ can_select: boolean | null; can_insert: boolean | null }[]>`
        SELECT has_table_privilege(current_user, 'public.group_training_plans', 'SELECT')
          AS can_select,
          has_table_privilege(current_user, 'public.group_training_plans', 'INSERT')
          AS can_insert`
      process.stdout.write(JSON.stringify({
        database: db[0],
        exists: relations.length === 1,
        relations: Array.from(relations),
        columns: Array.from(columns),
        constraints: Array.from(constraints),
        indexes: Array.from(indexes),
        policies: Array.from(policies),
        referenceRolePermissions: permissions[0],
      }, null, 2) + '\n')
    })
  } finally {
    await sql.end()
  }
}

main().catch(error => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 1
})
