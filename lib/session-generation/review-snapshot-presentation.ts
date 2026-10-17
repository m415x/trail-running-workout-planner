import type { GenerationExplanation } from './generation-explanation'
import type { SharedSessionGenerationResult, SharedSessionEventProposal } from '@/types/training/session-generation.types'
import type { MicrocycleType } from '@/types/training/periodization.types'

export interface ReviewWeekIdentity {
  id: string
  weekNumber: number
  type: MicrocycleType
  startDate: string
  endDate: string
}

export interface SnapshotPresentationWeek {
  microcycleId: string
  weekNumber: number
  type: MicrocycleType
  startDate: string
  endDate: string
  events: SharedSessionEventProposal[]
  warnings: string[]
}

/** Pure, fail-closed projection: never regenerate or use SQLite weeks. */
export function deriveReviewSnapshotWeeks(input: {
  microcycles: readonly ReviewWeekIdentity[]
  proposal: Pick<SharedSessionGenerationResult, 'events'>
  generationExplanations: Record<string, GenerationExplanation>
}): SnapshotPresentationWeek[] {
  const byId=new Map(input.microcycles.map(week=>[week.id,week]))
  if(byId.size!==input.microcycles.length) throw new Error('Duplicate snapshot microcycle identity')
  const result=input.microcycles.map(week=>({
    microcycleId:week.id,weekNumber:week.weekNumber,type:week.type,
    startDate:week.startDate,endDate:week.endDate,
    events:[] as SharedSessionEventProposal[],warnings:[] as string[],
  }))
  const byWeek=new Map(result.map(week=>[week.microcycleId,week]))
  const seenKeys=new Set<string>()
  for(const event of input.proposal.events) {
    if(!event.prescriptions.length) throw new Error('Snapshot event without prescriptions')
    const linked=new Set<string>()
    for(const item of event.prescriptions) {
      if(seenKeys.has(item.generationKey)) throw new Error('Duplicate snapshot generationKey')
      seenKeys.add(item.generationKey)
      if(!Object.hasOwn(input.generationExplanations,item.generationKey))
        throw new Error('Missing snapshot generation explanation')
      if(!byId.has(item.prescription.microcycleId)) throw new Error('Snapshot microcycle missing in authorized scope')
      linked.add(item.prescription.microcycleId)
    }
    for(const microcycleId of linked) {
      const week=byWeek.get(microcycleId)
      if(!week) throw new Error('Snapshot week not available')
      week.events.push({...event,prescriptions:event.prescriptions.filter(
        item=>item.prescription.microcycleId===microcycleId,
      )})
    }
  }
  if(Object.keys(input.generationExplanations).length!==seenKeys.size)
    throw new Error('Snapshot explanations do not match prescriptions')
  return result.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.weekNumber-b.weekNumber)
}
