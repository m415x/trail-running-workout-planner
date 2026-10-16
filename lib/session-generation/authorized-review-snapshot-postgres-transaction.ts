import { randomUUID } from 'node:crypto'
import type postgres from 'postgres'

import { authorizeEffectiveCapability } from '@/lib/authorization/effective-authorization'
import { createAuthorizedReviewSnapshotPostgresConfirmationOperations } from './authorized-review-snapshot-postgres-confirmation'
import { generateReviewSnapshotFromEffectivePostgres } from './review-snapshot-generate-postgres'
import { readReviewSnapshotEffectiveManifestPostgres } from './review-snapshot-effective-manifest-postgres'
import { evaluateReviewSnapshotSourceFreshness } from './review-snapshot-source-freshness'
import { createReviewSnapshotPostgresInTransaction, getActiveReviewSnapshotPostgres } from './review-snapshot-postgres-repository'
import { createReviewSnapshotPostgresReconciliationPersist } from './review-snapshot-reconciliation-writer-postgres'
import type { ReviewSnapshotScopeResult } from './authorized-review-snapshot-scope'

type Client = ReturnType<typeof postgres>
type Transaction = postgres.TransactionSql
type Request = { readonly groupTrainingPlanId: string; readonly snapshotId: string }

interface Dependencies {
  readonly client: Client
  /** Only H2 identity is supplied here. Never accept actor identity from Request. */
  readonly authenticatedUserId: (tx: Transaction) => Promise<string | null>
  /** H3 selected Team is server-owned; membership is revalidated using tx. */
  readonly selectedTeamId: (userId: string, tx: Transaction) => Promise<string | null>
  readonly now: () => string
}

type Membership = {
  userId: string; teamId: string; preset: 'athlete'|'assistant'|'coach'|'admin'
  effectiveFrom: string; effectiveUntil: string|null; isActive: boolean
}

async function readAffectedGroupIds(
  tx: Transaction, planId: string, teamId: string, proposal: unknown,
): Promise<Set<string> | null> {
  if (!proposal || typeof proposal !== 'object' || !('events' in proposal) ||
    !Array.isArray(proposal.events)) return null
  const plans = await tx<{groupId:string}[]>`
    SELECT p.group_id AS "groupId" FROM group_training_plans p
    JOIN athlete_groups g ON g.id=p.group_id
    WHERE p.id=${planId} AND p.is_deleted=false AND g.is_deleted=false
      AND g.team_id=${teamId} AND g.is_active=true`
  if (plans.length !== 1) return null
  const groups = new Set<string>([plans[0].groupId])
  const eventKeys:string[]=[]
  for (const event of proposal.events) {
    if (!event || typeof event !== 'object' ||
      typeof event.sharedEventKey !== 'string' || !event.sharedEventKey.trim() ||
      !Array.isArray(event.prescriptions)) return null
    eventKeys.push(event.sharedEventKey)
    for (const item of event.prescriptions) {
      const groupId=item?.prescription?.groupId
      if (typeof groupId !== 'string' || !groupId.trim()) return null
      groups.add(groupId)
    }
  }
  const microcycleIds=await tx<{id:string}[]>`
    SELECT mi.id FROM microcycles mi
    JOIN mesocycles me ON me.id=mi.mesocycle_id
    JOIN macrocycles ma ON ma.id=me.macrocycle_id
    WHERE ma.group_training_plan_id=${planId}
      AND ma.is_deleted=false AND me.is_deleted=false AND mi.is_deleted=false`
  const planSessionRows=microcycleIds.length ? await tx<{sessionId:string}[]>`
    SELECT DISTINCT gp.session_id AS "sessionId"
    FROM group_session_prescriptions gp
    WHERE gp.microcycle_id IN ${tx(microcycleIds.map(row=>row.id))}
      AND gp.is_deleted=false` : []
  const events=eventKeys.length ? await tx<{id:string;teamId:string}[]>`
    SELECT id,team_id AS "teamId" FROM sessions
    WHERE shared_event_key IN ${tx(eventKeys)}` : []
  const planSessions=planSessionRows.length ? await tx<{id:string;teamId:string}[]>`
    SELECT id,team_id AS "teamId" FROM sessions
    WHERE id IN ${tx(planSessionRows.map(row=>row.sessionId))}` : []
  const sessions=[...new Map([...events,...planSessions].map(row=>[row.id,row])).values()]
  if (sessions.some(row=>row.teamId!==teamId)) return null
  if (sessions.length) {
    const audience=await tx<{groupId:string}[]>`
      SELECT group_id AS "groupId" FROM group_session_prescriptions
      WHERE session_id IN ${tx(sessions.map(row=>row.id))}
        AND is_deleted=false`
    for (const row of audience) groups.add(row.groupId)
  }
  return groups
}

/**
 * Server-owned PG confirmation composition. The opaque snapshot ID only
 * locates data. H2 comes from the server; H3/H4A and the complete before/after
 * reconciliation audience are read in the same SERIALIZABLE transaction on
 * every attempt, including the recheck before persistence.
 */
export function createAuthorizedReviewSnapshotPostgresTransactionOperations(
  dependencies: Dependencies,
) {
  const check=async (tx:Transaction,request:Request & {createMode?:boolean;proposal?:unknown}): Promise<{
    decision:ReviewSnapshotScopeResult; affected:Set<string>|null
  }>=>{
    const denied={decision:{kind:'denied' as const},affected:null}
    const userId=await dependencies.authenticatedUserId(tx)
    if (!userId?.trim()) return denied
    const teamId=await dependencies.selectedTeamId(userId,tx)
    if (!teamId?.trim()) return denied
    const now=dependencies.now()
    const membership=await tx<Membership[]>`
      SELECT user_id AS "userId",team_id AS "teamId",preset,
        effective_from AS "effectiveFrom",effective_until AS "effectiveUntil",
        is_active AS "isActive"
      FROM team_memberships WHERE user_id=${userId} AND team_id=${teamId}
        AND is_deleted=false`
    const team=await tx<{id:string}[]>`
      SELECT id FROM teams WHERE id=${teamId} AND is_deleted=false`
    if (team.length!==1) return denied
    const plan=await tx<{groupId:string;planningCohortId:string|null}[]>`
      SELECT p.group_id AS "groupId",p.planning_cohort_id AS "planningCohortId"
      FROM group_training_plans p JOIN athlete_groups g ON g.id=p.group_id
      WHERE p.id=${request.groupTrainingPlanId} AND p.is_deleted=false
        AND g.is_deleted=false AND g.is_active=true AND g.team_id=${teamId}`
    if (plan.length!==1) return denied
    let proposal:unknown=request.proposal
    if(!request.createMode) {
      const snapshot=await tx<{userId:string;teamId:string;groupId:string;
        planningCohortId:string|null;proposal:unknown}[]>`
        SELECT user_id AS "userId",team_id AS "teamId",group_id AS "groupId",
          planning_cohort_id AS "planningCohortId",proposal
        FROM session_generation_review_snapshots
        WHERE id=${request.snapshotId} AND group_training_plan_id=${request.groupTrainingPlanId}`
      const row=snapshot[0]
      if(!row || row.userId!==userId || row.teamId!==teamId ||
        row.groupId!==plan[0].groupId ||
        row.planningCohortId!==plan[0].planningCohortId) return denied
      proposal=row.proposal
    }
    const cohortId=plan[0].planningCohortId
    if (cohortId!==null) {
      const cohorts=await tx<{id:string}[]>`
        SELECT id FROM planning_cohorts WHERE id=${cohortId}
          AND team_id=${teamId} AND group_id=${plan[0].groupId}
          AND status='active' AND is_deleted=false`
      if (cohorts.length!==1) return denied
    }
    const affected=proposal===undefined && request.createMode
      ? new Set([plan[0].groupId])
      : await readAffectedGroupIds(tx,request.groupTrainingPlanId,teamId,proposal)
    if (!affected || affected.size===0) return denied
    const validGroups=await tx<{id:string}[]>`
      SELECT id FROM athlete_groups
      WHERE id IN ${tx([...affected])} AND team_id=${teamId}
        AND is_deleted=false AND is_active=true`
    if (validGroups.length!==affected.size) return denied
    for (const groupId of affected) {
      if (!authorizeEffectiveCapability({
        authenticatedUserId:userId,teamId,capability:'planning.manage',
        resource:{teamId,sportingGroupId:groupId},at:now,
        memberships:membership,athleteProfiles:[],grants:[],
      }).allowed) return denied
    }
    return {decision:{kind:'authorized',scope:{
      userId,teamId,groupTrainingPlanId:request.groupTrainingPlanId,
      groupId:plan[0].groupId,planningCohortId:cohortId,
    }},affected}
  }
  // Tx-local state: never reuse a decision from a different retry/connection.
  const byTransaction=new WeakMap<Transaction,Set<string>>()
  const confirmation=createAuthorizedReviewSnapshotPostgresConfirmationOperations({
    client:dependencies.client,now:dependencies.now,
    authorize:async (tx,request)=>{
      const result=await check(tx,request)
      if(result.decision.kind==='authorized'&&result.affected) {
        byTransaction.set(tx,result.affected)
      }
      return result.decision
    },
    persist:async (tx,snapshot)=>{
      const groups=byTransaction.get(tx)
      if (!groups) throw new Error('reconciliation_conflict: missing transactional authorization')
      const persist=createReviewSnapshotPostgresReconciliationPersist({
        authorizedGroupIds:groups,now:dependencies.now,
      })
      return persist(tx,snapshot)
    },
  })
  return {
    ...confirmation,
    async getPlanContext(request:{readonly groupTrainingPlanId:string}) {
      if (!request.groupTrainingPlanId?.trim()) return {kind:'denied' as const}
      return dependencies.client.begin(async tx => {
        await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
        const decision=await check(tx,{
          groupTrainingPlanId:request.groupTrainingPlanId,snapshotId:'',createMode:true,
        })
        if (decision.decision.kind!=='authorized') return {kind:'denied' as const}
        const scope=decision.decision.scope
        const rows=await tx<{title:string;groupCategory:string;groupLevel:string;
          groupId:string;planningCohortId:string|null}[]>`
          SELECT p.title, g.category_code AS "groupCategory",
            g.level_code AS "groupLevel",p.group_id AS "groupId",
            p.planning_cohort_id AS "planningCohortId"
          FROM group_training_plans p
          JOIN athlete_groups g ON g.id=p.group_id AND g.is_deleted=false AND g.is_active=true
          WHERE p.id=${scope.groupTrainingPlanId} AND p.is_deleted=false
            AND g.team_id=${scope.teamId} AND p.group_id=${scope.groupId}
          LIMIT 1
        `
        if (rows.length!==1 || rows[0].planningCohortId!==scope.planningCohortId)
          return {kind:'denied' as const}
        return {kind:'available' as const,plan:{
          id:scope.groupTrainingPlanId,title:rows[0].title,
          groupId:rows[0].groupId,groupCategory:rows[0].groupCategory,
          groupLevel:rows[0].groupLevel,planningCohortId:scope.planningCohortId,
        }}
      })
    },
    async create(request:{readonly groupTrainingPlanId:string}) {
      if (!request.groupTrainingPlanId?.trim()) return {kind:'denied' as const}
      return dependencies.client.begin(async tx=>{
        await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
        const first=await check(tx,{groupTrainingPlanId:request.groupTrainingPlanId,
          snapshotId:'',createMode:true})
        if(first.decision.kind!=='authorized') return {kind:'denied' as const}
        const scope=first.decision.scope
        const generated=await generateReviewSnapshotFromEffectivePostgres(tx,scope)
        const second=await check(tx,{groupTrainingPlanId:request.groupTrainingPlanId,
          snapshotId:'',createMode:true,proposal:generated.proposal})
        if(second.decision.kind!=='authorized' ||
          JSON.stringify(second.decision.scope)!==JSON.stringify(scope)) {
          return {kind:'denied' as const}
        }
        const current=await readReviewSnapshotEffectiveManifestPostgres(tx,scope)
        if(evaluateReviewSnapshotSourceFreshness(generated.sourceManifest,current).kind!=='current') {
          throw new Error('generation_stale: source facts changed during CREATE')
        }
        const ids=[...new Set(generated.proposal.events.flatMap(event=>
          event.prescriptions.map(item=>item.prescription.microcycleId)))]
        const lineage=ids.length ? await tx<{id:string}[]>`
          SELECT mi.id FROM microcycles mi
          JOIN mesocycles me ON me.id=mi.mesocycle_id
          JOIN macrocycles ma ON ma.id=me.macrocycle_id
          WHERE mi.id IN ${tx(ids)} AND ma.group_training_plan_id=${scope.groupTrainingPlanId}
            AND mi.is_deleted=false AND me.is_deleted=false AND ma.is_deleted=false
        ` : []
        if(lineage.length!==ids.length || generated.sessionCount!==generated.proposal.events.length ||
          generated.microcycleCount!==ids.length) {
          throw new Error('Snapshot generation scope or derived counts invalid')
        }
        const row=await createReviewSnapshotPostgresInTransaction(tx,{
          ...scope,id:randomUUID(),...generated,
        },dependencies.now())
        return {kind:'created' as const,snapshotId:row.id}
      })
    },
    async get(request:Request) {
      if(!request.groupTrainingPlanId?.trim() || !request.snapshotId?.trim())
        return {kind:'unavailable' as const}
      return dependencies.client.begin(async tx=>{
        await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
        const decision=await check(tx,request)
        if(decision.decision.kind!=='authorized') return {kind:'denied' as const}
        const scope=decision.decision.scope
        const snapshot=await getActiveReviewSnapshotPostgres(tx as unknown as Client,{
          id:request.snapshotId,userId:scope.userId,teamId:scope.teamId,
          groupTrainingPlanId:scope.groupTrainingPlanId,
        },dependencies.now())
        return snapshot ? {kind:'available' as const,snapshot} : {kind:'unavailable' as const}
      })
    },
  }

}
