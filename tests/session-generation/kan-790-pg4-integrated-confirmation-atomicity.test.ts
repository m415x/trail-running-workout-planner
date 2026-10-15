import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { readReviewSnapshotEffectiveManifestPostgres } from '@/lib/session-generation/review-snapshot-effective-manifest-postgres'
import { evaluateReviewSnapshotSourceFreshness } from '@/lib/session-generation/review-snapshot-source-freshness'
import { createAuthorizedReviewSnapshotPostgresConfirmationOperations } from '@/lib/session-generation/authorized-review-snapshot-postgres-confirmation'
import * as reconciliationWriter from '@/lib/session-generation/review-snapshot-reconciliation-writer-postgres'
import type { SnapshotRow } from '@/lib/session-generation/review-snapshot-postgres-repository'

test('KAN-790 PG-4 composes authorized CAS, freshness, Session prescription audit and rollback', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'KAN789_PG_URL required; SKIP is not acceptable')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan789_acceptance')
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan790-pg4-integrated'
  const now = '2026-10-14T21:30:00.000Z'
  const scope = { groupTrainingPlanId: id+'-plan', teamId: id+'-team', groupId: id+'-group' }
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db,
      'kan789_acceptance')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG2 effective',${now},${now})`
    await sql`INSERT INTO athlete_groups (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${scope.groupId},'PG2 Plan',${now},${now})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
      VALUES (${id+'-macro'},'Macro',${scope.groupTrainingPlanId},
        '2027-01-01','2027-03-31',${now},${now})`
    await sql`INSERT INTO mesocycles
      (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
      VALUES (${id+'-meso'},${id+'-macro'},'Meso',1,'general_preparatory','base',${now},${now})`
    await sql`INSERT INTO microcycles
      (id,mesocycle_id,week_number,type,start_date,end_date,target_volume_km,created_at,updated_at)
      VALUES (${id+'-micro'},${id+'-meso'},1,'base','2027-01-04','2027-01-10',
        42,${now},${now})`
    await sql`INSERT INTO load_strategies
      (id,group_training_plan_id,goal_type,initial_weekly_volume_km,
       maximum_weekly_volume_km,sessions_per_week,maximum_weekly_increase_percentage,
       deload_percentage,field_sources,created_at,updated_at)
      VALUES (${id+'-load'},${scope.groupTrainingPlanId},'finish',30,60,4,10,30,
        (${JSON.stringify({})}::text)::jsonb,${now},${now})`
    await sql`INSERT INTO intensity_strategies
      (id,group_training_plan_id,goal_type,default_method,
       maximum_intense_sessions_per_week,minimum_recovery_days_between_intense_sessions,
       field_sources,created_at,updated_at)
      VALUES (${id+'-intensity'},${scope.groupTrainingPlanId},'finish','hr_zone',2,2,
        ${JSON.stringify({})}::jsonb,${now},${now})`
    await sql`INSERT INTO microcycle_intensity_targets
      (id,microcycle_id,emphasis,intense_sessions_target,predominant_zone,
       minimum_recovery_days_between_intense_sessions,field_sources,created_at,updated_at)
      VALUES (${id+'-target'},${id+'-micro'},'aerobic',1,'Z2',2,
        ${JSON.stringify({})}::jsonb,${now},${now})`
    await sql`INSERT INTO competition_entries
      (id,group_training_plan_id,name,date,distance_km,priority,created_at,updated_at)
      VALUES (${id+'-race'},${scope.groupTrainingPlanId},'Race','2027-02-01',21,
        'A',${now},${now})`

    await sql`INSERT INTO users
      (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${id+'-user'},${id+'-user'},${id+'@example.invalid'},
        'PG3','Stale',${now},${now})`
    const baseline = await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      return readReviewSnapshotEffectiveManifestPostgres(tx,scope)
    })
    assert.equal(baseline?.generationInputCount,1)
    const proposal={
      events:[{
        sharedEventKey:id+'-shared',
        session:{date:'2027-01-05',title:'PG4 integrated',
          type:'Trail',sourceTemplateId:null,locationKey:null,
          trackPath:null,structure:null,notes:null},
        prescriptions:[{
          generationKey:id+'-generation',slotKey:'tuesday-base',
          role:'base',warnings:[],
          prescription:{groupId:scope.groupId,microcycleId:id+'-micro',
            distanceKm:10,durationMin:null,elevationGain:null,
            intensityMethod:'hr_zone',zone:'Z2',
            referencePercentage:null,notes:null},
        }],
        warnings:[],
      }],
      warnings:[],
    }
    await sql`INSERT INTO session_generation_review_snapshots
      (id,user_id,team_id,group_training_plan_id,group_id,
       schema_version,generator_version,proposal,generation_explanations,
       source_manifest,created_at,expires_at,status)
      VALUES (${id+'-snapshot'},${id+'-user'},${scope.teamId},
        ${scope.groupTrainingPlanId},${scope.groupId},'1','1',
        (${JSON.stringify(proposal)}::text)::jsonb,(${JSON.stringify({})}::text)::jsonb,
        (${JSON.stringify(baseline)}::text)::jsonb,${now},
        '2026-10-15T21:30:00.000Z','active')`
    // Diagnose generation freshness independently before exercising CAS/writer:
    // SQL snapshot serialization and current PG source projection must match.
    const stored=await sql<{source_manifest:unknown}[]>`
      SELECT source_manifest FROM session_generation_review_snapshots
      WHERE id=${id+'-snapshot'}`
    const storedExplanations=await sql<{generation_explanations:unknown}[]>`
      SELECT generation_explanations FROM session_generation_review_snapshots
      WHERE id=${id+'-snapshot'}`
    assert.deepEqual(storedExplanations[0]?.generation_explanations, {},
      'SQL JSONB must preserve the generation explanations as an object')
    const reread=await sql.begin(async tx=>{
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      return readReviewSnapshotEffectiveManifestPostgres(tx,scope)
    })
    assert.deepEqual(stored[0]?.source_manifest,baseline,
      'SQL JSONB must preserve the generation manifest')
    assert.deepEqual(reread,baseline,
      'Unchanged PostgreSQL generation sources must recreate the same manifest')
    assert.deepEqual(evaluateReviewSnapshotSourceFreshness(stored[0]?.source_manifest,reread),
      {kind:'current'},
      'Snapshot and current SQL facts must agree before confirmation')
    // Explicit functional RED: the concrete PG writer adapter is not yet exposed.
    // PG-3's generic persist callback alone does not prove real reconciliation.
    const factory = (reconciliationWriter as unknown as {
      createReviewSnapshotPostgresReconciliationPersist?: (dependencies: {
        authorizedGroupIds: ReadonlySet<string>
        now: () => string
      }) => (tx: postgres.TransactionSql, snapshot: SnapshotRow) => Promise<string>
    }).createReviewSnapshotPostgresReconciliationPersist
    assert.equal(typeof factory,'function',
      'PG-4 requires concrete snapshot-to-PostgreSQL reconciliation persist adapter')
    const persist = factory!({
      authorizedGroupIds:new Set([scope.groupId]),now:()=>now,
    })
    let failAfterWriting = true
    const operations=createAuthorizedReviewSnapshotPostgresConfirmationOperations({
      client:sql,
      authorize:async tx=>{
        const level=await tx<{isolation:string}[]>`
          SELECT current_setting('transaction_isolation') AS isolation`
        assert.equal(level[0]?.isolation,'serializable')
        return {kind:'authorized' as const,scope:{
          ...scope,userId:id+'-user',planningCohortId:null,
        }}
      },
      now:()=>now,
      persist:async (tx,snapshot)=>{
        const result=await persist(tx,snapshot)
        if(failAfterWriting) throw new Error('pg4-integrated-injected-rollback')
        return result
      },
    })
    const request={groupTrainingPlanId:scope.groupTrainingPlanId,
      snapshotId:id+'-snapshot'}
    await assert.rejects(operations.confirm(request),
      /pg4-integrated-injected-rollback/)
    const counts=async()=>{
      const [sessions,prescriptions,audits]=await Promise.all([
        sql<{n:number}[]>`SELECT count(*)::integer AS n FROM sessions
          WHERE shared_event_key=${id+'-shared'}`,
        sql<{n:number}[]>`SELECT count(*)::integer AS n FROM group_session_prescriptions
          WHERE generation_key=${id+'-generation'}`,
        sql<{n:number}[]>`SELECT count(*)::integer AS n FROM session_generation_modification_records
          WHERE group_training_plan_id=${scope.groupTrainingPlanId}`,
      ])
      return [sessions[0]?.n,prescriptions[0]?.n,audits[0]?.n]
    }
    assert.deepEqual(await counts(),[0,0,0],
      'aborted CAS must also roll back real Session, prescription and audit')
    assert.deepEqual((await sql<{status:string;result_reference:string|null}[]>`
      SELECT status,result_reference FROM session_generation_review_snapshots
      WHERE id=${id+'-snapshot'}`)[0],
      {status:'active',result_reference:null})
    failAfterWriting=false
    assert.deepEqual(await operations.confirm(request),
      {kind:'consumed',resultReference:scope.groupTrainingPlanId})
    assert.deepEqual(await counts(),[1,1,2])
    assert.deepEqual(await operations.confirm(request),
      {kind:'already_consumed',resultReference:scope.groupTrainingPlanId})
    assert.deepEqual(await counts(),[1,1,2],
      'idempotent replay must not append audit or duplicate durable rows')

    // PG-4 RED: a second Plan with separate microcycle identity must be able to
    // consume its own snapshot onto the same shared Session, without replacing
    // or deleting the first Plan's prescription and audit evidence.
    const siblingPlanId=id+'-sibling-plan'
    const cohortId=id+'-variant-cohort'
    await sql`INSERT INTO planning_cohorts
      (id,team_id,group_id,name,purpose,status,created_at,updated_at)
      VALUES (${cohortId},${scope.teamId},${scope.groupId},'PG4 Variant',
        'PG4 variant lineage','active',${now},${now})`
    await sql`INSERT INTO group_training_plans
      (id,group_id,title,planning_cohort_id,source_group_training_plan_id,created_at,updated_at)
      VALUES (${siblingPlanId},${scope.groupId},'Variant Plan',${cohortId},
        ${scope.groupTrainingPlanId},${now},${now})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
      VALUES (${id+'-sibling-macro'},'Sibling Macro',${siblingPlanId},
        '2027-01-01','2027-03-31',${now},${now})`
    await sql`INSERT INTO mesocycles
      (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
      VALUES (${id+'-sibling-meso'},${id+'-sibling-macro'},'Sibling Meso',
        1,'general_preparatory','base',${now},${now})`
    await sql`INSERT INTO microcycles
      (id,mesocycle_id,week_number,type,start_date,end_date,target_volume_km,
       created_at,updated_at)
      VALUES (${id+'-sibling-micro'},${id+'-sibling-meso'},1,'base',
        '2027-01-04','2027-01-10',42,${now},${now})`
    await sql`INSERT INTO load_strategies
      (id,group_training_plan_id,goal_type,initial_weekly_volume_km,
       maximum_weekly_volume_km,sessions_per_week,maximum_weekly_increase_percentage,
       deload_percentage,field_sources,created_at,updated_at)
      VALUES (${id+'-sibling-load'},${siblingPlanId},'finish',30,60,4,10,30,
        (${JSON.stringify({})}::text)::jsonb,${now},${now})`
    await sql`INSERT INTO intensity_strategies
      (id,group_training_plan_id,goal_type,default_method,
       maximum_intense_sessions_per_week,minimum_recovery_days_between_intense_sessions,
       field_sources,created_at,updated_at)
      VALUES (${id+'-sibling-intensity'},${siblingPlanId},'finish','hr_zone',2,2,
        (${JSON.stringify({})}::text)::jsonb,${now},${now})`
    await sql`INSERT INTO microcycle_intensity_targets
      (id,microcycle_id,emphasis,intense_sessions_target,predominant_zone,
       minimum_recovery_days_between_intense_sessions,field_sources,
       created_at,updated_at)
      VALUES (${id+'-sibling-target'},${id+'-sibling-micro'},'aerobic',1,'Z2',2,
        (${JSON.stringify({})}::text)::jsonb,${now},${now})`
    const siblingScope={...scope,groupTrainingPlanId:siblingPlanId}
    const siblingManifest=await sql.begin(async tx=>{
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      return readReviewSnapshotEffectiveManifestPostgres(tx,siblingScope)
    })
    assert.equal(siblingManifest?.generationInputCount,1)
    const siblingProposal={
      ...proposal,
      events:proposal.events.map(event=>({
        ...event,
        prescriptions:event.prescriptions.map(item=>({
          ...item,generationKey:id+'-sibling-generation',
          prescription:{...item.prescription,microcycleId:id+'-sibling-micro'},
        })),
      })),
    }
    await sql`INSERT INTO session_generation_review_snapshots
      (id,user_id,team_id,group_training_plan_id,group_id,
       planning_cohort_id,schema_version,generator_version,proposal,generation_explanations,
       source_manifest,created_at,expires_at,status)
      VALUES (${id+'-sibling-snapshot'},${id+'-user'},${scope.teamId},
        ${siblingPlanId},${scope.groupId},${cohortId},'1','1',
        (${JSON.stringify(siblingProposal)}::text)::jsonb,
        (${JSON.stringify({})}::text)::jsonb,
        (${JSON.stringify(siblingManifest)}::text)::jsonb,${now},
        '2026-10-15T21:30:00.000Z','active')`
    const siblingOperations=createAuthorizedReviewSnapshotPostgresConfirmationOperations({
      client:sql,
      authorize:async tx=>{
        const isolation=await tx<{value:string}[]>`
          SELECT current_setting('transaction_isolation') AS value`
        assert.equal(isolation[0]?.value,'serializable')
        return {kind:'authorized' as const,scope:{
          ...siblingScope,userId:id+'-user',planningCohortId:cohortId,
        }}
      },
      now:()=>now,
      persist,
    })
    const siblingRequest={groupTrainingPlanId:siblingPlanId,
      snapshotId:id+'-sibling-snapshot'}
    assert.deepEqual(await siblingOperations.confirm(siblingRequest),
      {kind:'consumed',resultReference:siblingPlanId})
    const sharedCount=await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM sessions
      WHERE shared_event_key=${id+'-shared'}`
    const prescriptionCount=await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM group_session_prescriptions
      WHERE generation_key IN (${id+'-generation'},${id+'-sibling-generation'})
        AND is_deleted=false`
    assert.equal(sharedCount[0]?.n,1,
      'both Plan snapshots must reuse a single durable shared Session')
    assert.equal(prescriptionCount[0]?.n,2,
      'each Plan must retain its own microcycle prescription')
    assert.deepEqual(await siblingOperations.confirm(siblingRequest),
      {kind:'already_consumed',resultReference:siblingPlanId})

  } finally {
    try {
      await sql`DELETE FROM session_generation_review_snapshots
        WHERE id = ${id+'-sibling-snapshot'}`
      await sql`DELETE FROM session_generation_review_snapshots WHERE id = ${id+'-snapshot'}`
      await sql`DELETE FROM session_generation_modification_records
        WHERE group_training_plan_id=${id+'-sibling-plan'}`
      await sql`DELETE FROM session_generation_modification_records
        WHERE group_training_plan_id=${scope.groupTrainingPlanId}`
      await sql`DELETE FROM group_session_prescriptions
        WHERE generation_key=${id+'-sibling-generation'}`
      await sql`DELETE FROM group_session_prescriptions
        WHERE generation_key=${id+'-generation'}`
      await sql`DELETE FROM sessions WHERE shared_event_key=${id+'-shared'}`
      await sql`DELETE FROM competition_entries WHERE id = ${id+'-race'}`
      await sql`DELETE FROM microcycle_intensity_targets WHERE id = ${id+'-sibling-target'}`
      await sql`DELETE FROM microcycle_intensity_targets WHERE id = ${id+'-target'}`
      await sql`DELETE FROM intensity_strategies WHERE id = ${id+'-sibling-intensity'}`
      await sql`DELETE FROM load_strategies WHERE id = ${id+'-sibling-load'}`
      await sql`DELETE FROM intensity_strategies WHERE id = ${id+'-intensity'}`
      await sql`DELETE FROM load_strategies WHERE id = ${id+'-load'}`
      await sql`DELETE FROM microcycles WHERE id = ${id+'-micro'}`
      await sql`DELETE FROM mesocycles WHERE id = ${id+'-meso'}`
      await sql`DELETE FROM microcycles WHERE id = ${id+'-sibling-micro'}`
      await sql`DELETE FROM mesocycles WHERE id = ${id+'-sibling-meso'}`
      await sql`DELETE FROM macrocycles WHERE id = ${id+'-sibling-macro'}`
      await sql`DELETE FROM macrocycles WHERE id = ${id+'-macro'}`
      await sql`DELETE FROM group_training_plans WHERE id = ${id+'-sibling-plan'}`
      await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
      await sql`DELETE FROM planning_cohorts WHERE id = ${id+'-variant-cohort'}`
      await sql`DELETE FROM athlete_groups WHERE id = ${scope.groupId}`
      await sql`DELETE FROM teams WHERE id = ${scope.teamId}`
      await sql`DELETE FROM users WHERE id = ${id+'-user'}`
    } finally {
      await sql.end()
    }
  }
})
