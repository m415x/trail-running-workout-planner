import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { getCoachPostgresReviewPlanContext, getCoachPostgresReviewMicrocycles, readCoachSessionReviewSnapshot } from '@/app/actions/coach-session-review-snapshot-actions'
import { CoachPostgresSnapshotReview } from '@/features/planning/components/CoachPostgresSnapshotReview'
import type { ReviewWeekIdentity } from '@/lib/session-generation/review-snapshot-presentation'

interface ReviewPageProps {
  params: Promise<{locale:string;planId:string}>
  searchParams: Promise<{snapshotId?:string}>
}

/**
 * Dedicated PostgreSQL Coach review entry. No SQLite Plan/editor is mounted.
 * T6-A resolves only authorized identity; T6-B/C will render the snapshot and
 * explicit CREATE/CONFIRM without adding implicit work to this GET.
 */
export default async function CoachPostgresReviewPage({params,searchParams}:ReviewPageProps) {
  const {locale,planId}=await params
  const {snapshotId}=await searchParams
  const result=await getCoachPostgresReviewPlanContext(planId)
  if(result.kind!=='available') notFound()
  const review=snapshotId ? await readCoachSessionReviewSnapshot({planId,snapshotId}) : null
  const microcycles=review?.kind==='available' ? await getCoachPostgresReviewMicrocycles(planId) : null
  if(review && review.kind!=='available') notFound()
  if(microcycles && microcycles.kind!=='available') notFound()
  const t=await getTranslations({locale,namespace:'CoachPlanning'})
  return (
    <main className='space-y-4'>
      <h1 className='text-2xl font-semibold'>{t('sessionPreview.title')}</h1>
      <p className='text-muted-foreground'>{t('sessionPreview.description')}</p>
      <section aria-label={t('sessionPreview.title')}>
        <h2 className='text-lg font-medium'>{result.plan.title}</h2>
        <p>{t('detail.group',{code:result.plan.groupCategory+result.plan.groupLevel})}</p>
      </section>
      {review?.kind==='available' && microcycles?.kind==='available' && (
        <CoachPostgresSnapshotReview snapshot={review.snapshot}
          microcycles={microcycles.microcycles as ReviewWeekIdentity[]}
          planId={planId} locale={locale}/>
      )}
    </main>
  )
}
