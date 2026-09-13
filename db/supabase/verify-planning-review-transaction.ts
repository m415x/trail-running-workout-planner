import { config } from 'dotenv'
import postgres from 'postgres'

import { persistIntegralPlanningReconciliationAsync } from '@/lib/periodization/planning-review-persistence'
import type {
  AsyncPlanningReviewTransactionPort,
  PlanningReviewAtomicAuditRecord,
  PersistedIntegralPlanningReconciliation,
} from '@/types/training/planning-review-persistence.types'
import type {
  IntegralPlanningReconciliation,
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'

config({ path: '.env.local' })

type PostgresClient = ReturnType<typeof postgres>
type PostgresTransaction = Parameters<Parameters<PostgresClient['begin']>[0]>[0]

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

function operation(): PlanningReviewScopedOperation {
  return {
    scope,
    identity: 'microcycle:h11-probe',
    parentIdentity: 'mesocycle:h11-probe',
    entity: { entityType: 'microcycle', entityId: 'h11-probe-microcycle' },
    operation: 'update',
    changes: [{ field: 'targetVolumeKm', currentValue: 40, proposedValue: 42 }],
    blockId: 'h11-probe-block',
    decisionProvenance: provenance,
  }
}

function reconciliation(): IntegralPlanningReconciliation {
  const current = operation()
  return {
    scope,
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

  transaction<TResult>(work: (tx: PostgresTransaction) => Promise<TResult>): Promise<TResult> {
    return this.sql.begin(async (tx) => work(tx))
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
}

async function resetProbeTables(sql: PostgresClient) {
  await sql`truncate h11_planning_review_operations, h11_planning_review_audits, h11_planning_review_journal`
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

  const constraints = await sql<{ constraintName: string }[]>`
    select con.conname as "constraintName"
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'competition_entries'
  `
  if (!constraints.some(({ constraintName }) => (
    constraintName === 'competition_entries_group_training_plan_id_group_training_plans_id_fk'
  ))) {
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
    ) {
      throw new Error(`Unexpected committed probe counts: ${JSON.stringify(committedCounts)}`)
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
    if (rollbackCounts.operations !== 0 || rollbackCounts.audits !== 0 || rollbackCounts.journal !== 0) {
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
    if (isolationCounts.operations !== 0 || isolationCounts.audits !== 0 || isolationCounts.journal !== 0) {
      throw new Error(`Isolation rejection opened a write: ${JSON.stringify(isolationCounts)}`)
    }

    console.log('H11 Supabase planning transaction probe: OK')
    console.log('Commit/replay:', committedCounts)
    console.log('Rollback:', rollbackCounts)
    console.log('Isolation:', isolationCounts)
  } finally {
    await sql.end()
  }
}

void main()
