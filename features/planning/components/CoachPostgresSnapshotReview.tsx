import type { SnapshotRow } from '@/lib/session-generation/review-snapshot-postgres-repository'
import type { ReviewWeekIdentity } from '@/lib/session-generation/review-snapshot-presentation'
import { deriveReviewSnapshotWeeks } from '@/lib/session-generation/review-snapshot-presentation'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'
import type { GenerationExplanation } from '@/lib/session-generation/generation-explanation'
import { SessionGenerationPreview } from './SessionGenerationPreview'

/** Render only the persisted server-owned review, never SQLite-derived weeks. */
export function CoachPostgresSnapshotReview({snapshot,microcycles,planId,locale}:{
  snapshot:SnapshotRow
  microcycles:ReviewWeekIdentity[]
  planId:string
  locale:string
}) {
  const proposal=snapshot.proposal as SharedSessionGenerationResult
  const generationExplanations=snapshot.generationExplanations as Record<string,GenerationExplanation>
  const weeks=deriveReviewSnapshotWeeks({microcycles,proposal,generationExplanations})
  return <SessionGenerationPreview
    weeks={weeks}
    warnings={proposal.warnings}
    isAvailable={true}
    planId={planId}
    locale={locale}
    generationExplanations={generationExplanations}
    reviewedSnapshot={snapshot}
  />
}
