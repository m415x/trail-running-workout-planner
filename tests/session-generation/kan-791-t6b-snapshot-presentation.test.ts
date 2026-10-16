import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

test('KAN-791 T6-B review renderer derives week coverage from server-owned snapshot rather than SQLite weeks', () => {
  const path='features/planning/components/CoachPostgresSnapshotReview.tsx'
  const route='app/[locale]/dashboard/planning/[planId]/review/page.tsx'
  const code=readFileSync(path,'utf8')
  const routeCode=readFileSync(route,'utf8')
  assert.match(routeCode,/CoachPostgresSnapshotReview/)
  assert.match(code,/snapshot\.proposal/)
  assert.match(code,/snapshot\.generationExplanations/)
  assert.match(code,/deriveReviewSnapshotWeeks/)
  assert.doesNotMatch(code,/getGroupTrainingPlanById|@\/db|generationResults|generateWeeklySessionProposals/)
})

test('KAN-791 T6-B grouping must preserve every generationKey from 239 prescriptions', async () => {
  const {deriveReviewSnapshotWeeks}=await import('@/lib/session-generation/review-snapshot-presentation')
  const weeks=Array.from({length:53},(_,i)=>({
    id:'micro-'+i,weekNumber:i+1,type:'development' as const,
    startDate:'2027-01-04',endDate:'2027-01-10',
  }))
  const events=Array.from({length:239},(_,i)=>{
    const w=i<135?Math.floor(i/5):27+Math.floor((i-135)/4)
    return {
      sharedEventKey:'event-'+i,
      prescriptions:[{
        generationKey:'generation-'+i,
        prescription:{microcycleId:'micro-'+w},
      }],
    }
  })
  const explanations=Object.fromEntries(events.map((event,i)=>['generation-'+i,{stages:[]}]))
  const grouped=deriveReviewSnapshotWeeks({
    microcycles:weeks,proposal:{events},generationExplanations:explanations,
  })
  assert.equal(grouped.length,53)
  assert.equal(grouped.reduce((sum,week)=>sum+week.events.length,0),239)
  assert.equal(grouped.reduce((sum,week)=>sum+week.events.reduce((n,event)=>n+event.prescriptions.length,0),0),239)
  assert.equal(grouped.reduce((sum,week)=>sum+week.events.reduce((n,event)=>n+event.prescriptions.filter(p=>p.generationKey in explanations).length,0),0),239)
})
