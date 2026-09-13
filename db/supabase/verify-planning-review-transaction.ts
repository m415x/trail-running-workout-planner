import { config } from 'dotenv'
import postgres from 'postgres'

import {
  persistIntegralPlanningReconciliationAsync,
  StalePlanningReviewError,
} from '@/lib/periodization/planning-review-persistence'
import type {
  AsyncPlanningReviewTransactionPort,
  PlanningReviewAtomicAuditRecord,
  PersistedIntegralPlanningReconciliation,
} from '@/types/training/planning-review-persistence.types'
import type {
  IntegralPlanningReconciliation,
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'
import type { PlanningReviewScope } from '@/types/training/planning-review.types'

config({ path: '.env.local' })

type PostgresClient = ReturnType<typeof postgres>
type BeginCallback = NonNullable<Parameters<PostgresClient['begin']>[1]>
type PostgresTransaction = Parameters<BeginCallback>[0]

const scope = {
  teamId: 'h11-probe-team',
  groupId: 'h11-probe-group',
  groupTrainingPlanId: 'h11-probe-plan',
  kind: 'group_base' as const,
  planningCohortId: null,
  sourceGroupTrainingPlanId: null,
}

const provenance = {
  source: 'coach' as const,
  coachId: 'h11-probe-coach',
  decidedAt: '2026-09-12T22:15:00.000-03:00',
  reason: 'Supabase transaction probe',
}

function operation(proposedValue = 42): PlanningReviewScopedOperation {
  return {
    scope,
    identity: 'microcycle:h11-probe',
    parentIdentity: 'mesocycle:h11-probe',
    entity: { entityType: 'microcycle', entityId: 'h11-probe-microcycle' },
    operation: 'update',
    changes: [{ field: 'targetVolumeKm', currentValue: 40, proposedValue }],
    blockId: 'h11-probe-block',
    decisionProvenance: provenance,
  }
}

function reconciliation(
  sourceRevisionKey = 'revision-a',
  resultRevisionKey = 'revision-b',
  proposedValue = 42,
): IntegralPlanningReconciliation {
  const current = operation(proposedValue)
  return {
    scope,
    sourceRevisionKey,
    resultRevisionKey,
    blocks: [{
      blockId: current.blockId,
      root: current.entity,
      range: { startDate: '2026-09-07', endDate: '2026-09-13' },
      operationIdentities: [current.identity],
      decisionProvenance: provenance,
    }],
    operations: [current],
    planningOperations: [current],
    sessionOperations: [],
    prescriptionOperations: [],
    competitionOperations: [],
    acceptedItemIdentities: [current.identity],
    rejectedBlockIds: [],
    pendingBlockIds: [],
    coachDecisions: [{
      blockId: current.blockId,
      decision: 'accept',
      provenance,
    }],
  }
}

class SupabaseProbePort implements AsyncPlanningReviewTransactionPort<PostgresTransaction> {
  constructor(
    private readonly sql: PostgresClient,
    private readonly failAuditIdentity: string | null = null,
  ) {}

  async transaction<TResult>(work: (tx: PostgresTransaction) => Promise<TResult>): Promise<TResult> {
    const result = await this.sql.begin(async (tx) => work(tx))
    return result as TResult
  }

  async findCommittedResult(tx: PostgresTransaction, idempotencyKey: string) {
    const rows = await tx<{ result: string }[]>`
      select result
      from h11_planning_review_journal
      where idempotency_key = ${idempotencyKey}
      limit 1
    `
    return rows[0]
      ? JSON.parse(rows[0].result) as PersistedIntegralPlanningReconciliation
      : null
  }

  async lockSourceRevision(tx: PostgresTransaction, currentScope: PlanningReviewScope) {
    const rows = await tx<{ revisionKey: string }[]>`
      select revision_key as "revisionKey"
      from h11_planning_review_revisions
      where plan_id = ${currentScope.groupTrainingPlanId}
      for update
    `
    if (!rows[0]) throw new Error('H11 probe revision row is missing')
    return rows[0].revisionKey
  }

  async applyOperation(tx: PostgresTransaction, current: PlanningReviewScopedOperation) {
    await tx`
      insert into h11_planning_review_operations (identity, scope, payload)
      values (
        ${current.identity},
        ${JSON.stringify(current.scope)},
        ${JSON.stringify(current)}
      )
    `
  }

  async appendAuditRecord(tx: PostgresTransaction, record: PlanningReviewAtomicAuditRecord) {
    if (record.identity === this.failAuditIdentity) {
      throw new Error(`intentional audit failure: ${record.identity}`)
    }
    await tx`
      insert into h11_planning_review_audits (identity, scope, payload)
      values (
        ${record.identity},
        ${JSON.stringify(record.scope)},
        ${JSON.stringify(record)}
      )
    `
  }

  async markCommitted(
    tx: PostgresTransaction,
    idempotencyKey: string,
    result: PersistedIntegralPlanningReconciliation,
  ) {
    await tx`
      insert into h11_planning_review_journal (idempotency_key, result)
      values (${idempotencyKey}, ${JSON.stringify(result)})
    `
  }

  async advanceSourceRevision(
    tx: PostgresTransaction,
    currentScope: PlanningReviewScope,
    sourceRevisionKey: string,
    resultRevisionKey: string,
  ) {
    const result = await tx`
      update h11_planning_review_revisions
      set revision_key = ${resultRevisionKey}
      where plan_id = ${currentScope.groupTrainingPlanId}
        and revision_key = ${sourceRevisionKey}
    `
    if (result.count !== 1) throw new Error('H11 probe source revision changed before advance')
  }
}

async function prepareProbeTables(sql: PostgresClient) {
  await sql`
    create temporary table if not exists h11_planning_review_operations (
      identity text not null,
      scope text not null,
      payload text not null
    ) on commit preserve rows
  `
  await sql`
    create temporary table if not exists h11_planning_review_audits (
      identity text not null,
      scope text not null,
      payload text not null
    ) on commit preserve rows
  `
  await sql`
    create temporary table if not exists h11_planning_review_journal (
      idempotency_key text primary key,
      result text not null
    ) on commit preserve rows
  `
  await sql`
    create temporary table if not exists h11_planning_review_revisions (
      plan_id text primary key,
      revision_key text not null
    ) on commit preserve rows
  `
}

async function resetProbeTables(sql: PostgresClient, revisionKey = 'revision-a') {
  await sql`
    truncate h11_planning_review_operations,
      h11_planning_review_audits,
      h11_planning_review_journal,
      h11_planning_review_revisions
  `
  await sql`
    insert into h11_planning_review_revisions (plan_id, revision_key)
    values (${scope.groupTrainingPlanId}, ${revisionKey})
  `
}

async function counts(sql: PostgresClient) {
  const [operations] = await sql<{ count: number }[]>`
    select count(*)::int as count from h11_planning_review_operations
  `
  const [audits] = await sql<{ count: number }[]>`
    select count(*)::int as count from h11_planning_review_audits
  `
  const [journal] = await sql<{ count: number }[]>`
    select count(*)::int as count from h11_planning_review_journal
  `
  return {
    operations: operations.count,
    audits: audits.count,
    journal: journal.count,
  }
}

async function currentRevision(sql: PostgresClient) {
  const [row] = await sql<{ revisionKey: string }[]>`
    select revision_key as "revisionKey"
    from h11_planning_review_revisions
    where plan_id = ${scope.groupTrainingPlanId}
  `
  return row?.revisionKey ?? null
}

async function verifyRequiredPlanningTables(sql: PostgresClient) {
  const requiredTables = [
    'group_training_plans',
    'macrocycles',
    'mesocycles',
    'microcycles',
    'sessions',
    'group_session_prescriptions',
    'competition_entries',
    'planning_modification_records',
  ] as const

  const rows = await sql<{ tableName: string }[]>`
    select c.relname as "tableName"
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in ${sql(requiredTables)}
  `
  const found = new Set(rows.map(({ tableName }) => tableName))
  const missing = requiredTables.filter((table) => !found.has(table))
  if (missing.length > 0) {
    throw new Error(`Missing H11 Supabase tables: ${missing.join(', ')}`)
  }

  const foreignKeys = await sql<{
    sourceColumn: string
    targetSchema: string
    targetTable: string
    targetColumn: string
  }[]>`
    select
      source_attribute.attname as "sourceColumn",
      target_namespace.nspname as "targetSchema",
      target_table.relname as "targetTable",
      target_attribute.attname as "targetColumn"
    from pg_constraint constraint_definition
    join pg_class source_table
      on source_table.oid = constraint_definition.conrelid
    join pg_namespace source_namespace
      on source_namespace.oid = source_table.relnamespace
    join pg_class target_table
      on target_table.oid = constraint_definition.confrelid
    join pg_namespace target_namespace
      on target_namespace.oid = target_table.relnamespace
    join lateral unnest(constraint_definition.conkey, constraint_definition.confkey)
      with ordinality as key_pair(source_attribute_number, target_attribute_number, ordinal_position)
      on true
    join pg_attribute source_attribute
      on source_attribute.attrelid = source_table.oid
      and source_attribute.attnum = key_pair.source_attribute_number
    join pg_attribute target_attribute
      on target_attribute.attrelid = target_table.oid
      and target_attribute.attnum = key_pair.target_attribute_number
    where constraint_definition.contype = 'f'
      and source_namespace.nspname = 'public'
      and source_table.relname = 'competition_entries'
  `

  const hasPlanForeignKey = foreignKeys.some((foreignKey) => (
    foreignKey.sourceColumn === 'group_training_plan_id'
    && foreignKey.targetSchema === 'public'
    && foreignKey.targetTable === 'group_training_plans'
    && foreignKey.targetColumn === 'id'
  ))
  if (!hasPlanForeignKey) {
    throw new Error('CompetitionEntry -> GroupTrainingPlan FK is missing')
  }
}

async function main() {
  const connectionString = process.env.SUPABASE_DIRECT_URL
  if (!connectionString) throw new Error('SUPABASE_DIRECT_URL no está configurada')

  const sql = postgres(connectionString, { prepare: false, max: 1 })

  try {
    await verifyRequiredPlanningTables(sql)
    await prepareProbeTables(sql)
    await resetProbeTables(sql)

    const port = new SupabaseProbePort(sql)
    const input = reconciliation()
    const first = await persistIntegralPlanningReconciliationAsync({
      reconciliation: input,
      persistence: port,
    })
    const replay = await persistIntegralPlanningReconciliationAsync({
      reconciliation: structuredClone(input),
      persistence: port,
    })
    const committedCounts = await counts(sql)

    if (first.outcome !== 'committed' || replay.outcome !== 'already_committed') {
      throw new Error('Supabase idempotency probe did not return committed/already_committed')
    }
    if (
      committedCounts.operations !== 1
      || committedCounts.audits !== 1
      || committedCounts.journal !== 1
      || await currentRevision(sql) !== 'revision-b'
    ) {
      throw new Error(`Unexpected committed probe state: ${JSON.stringify(committedCounts)}`)
    }

    const beforeStale = await counts(sql)
    let staleRejected = false
    try {
      await persistIntegralPlanningReconciliationAsync({
        reconciliation: reconciliation('revision-a', 'revision-c', 44),
        persistence: port,
      })
    } catch (error) {
      staleRejected = error instanceof StalePlanningReviewError
    }
    if (!staleRejected) throw new Error('Expected stale Supabase submission rejection')
    const afterStale = await counts(sql)
    if (JSON.stringify(beforeStale) !== JSON.stringify(afterStale)) {
      throw new Error('Stale Supabase submission changed persisted probe counts')
    }

    await resetProbeTables(sql)
    const rollbackPort = new SupabaseProbePort(sql, operation().identity)
    let rollbackFailed = false
    try {
      await persistIntegralPlanningReconciliationAsync({
        reconciliation: reconciliation(),
        persistence: rollbackPort,
      })
    } catch (error) {
      rollbackFailed = error instanceof Error && error.message.includes('intentional audit failure')
    }
    if (!rollbackFailed) throw new Error('Expected intentional Supabase rollback failure')

    const rollbackCounts = await counts(sql)
    if (
      rollbackCounts.operations !== 0
      || rollbackCounts.audits !== 0
      || rollbackCounts.journal !== 0
      || await currentRevision(sql) !== 'revision-a'
    ) {
      throw new Error(`Supabase rollback left partial state: ${JSON.stringify(rollbackCounts)}`)
    }

    const isolated = reconciliation()
    const crossScopeOperation = {
      ...isolated.operations[0],
      scope: { ...scope, groupId: 'other-group' },
    }
    const crossScope = {
      ...isolated,
      operations: [crossScopeOperation],
      planningOperations: [crossScopeOperation],
    }
    let isolationRejected = false
    try {
      await persistIntegralPlanningReconciliationAsync({
        reconciliation: crossScope,
        persistence: port,
      })
    } catch (error) {
      isolationRejected = error instanceof Error && error.message.includes('crosses the accepted planning scope')
    }
    if (!isolationRejected) throw new Error('Cross-scope Supabase write was not rejected')

    const isolationCounts = await counts(sql)
    if (
      isolationCounts.operations !== 0
      || isolationCounts.audits !== 0
      || isolationCounts.journal !== 0
      || await currentRevision(sql) !== 'revision-a'
    ) {
      throw new Error(`Isolation rejection opened a write: ${JSON.stringify(isolationCounts)}`)
    }

    console.log('H11 Supabase planning transaction probe: OK')
    console.log('Commit/replay:', committedCounts)
    console.log('Stale rejection:', afterStale)
    console.log('Rollback:', rollbackCounts)
    console.log('Isolation:', isolationCounts)
  } finally {
    await sql.end()
  }
}

void main()
