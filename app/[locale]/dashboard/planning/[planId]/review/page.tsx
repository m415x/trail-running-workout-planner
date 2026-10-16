import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { getCoachPostgresReviewPlanContext } from '@/app/actions/coach-session-review-snapshot-actions'

interface ReviewPageProps {
  params: Promise<{locale:string;planId:string}>
}

/**
 * Dedicated PostgreSQL Coach review entry. No SQLite Plan/editor is mounted.
 * T6-A resolves only authorized identity; T6-B/C will render the snapshot and
 * explicit CREATE/CONFIRM without adding implicit work to this GET.
 */
export default async function CoachPostgresReviewPage({params}:ReviewPageProps) {
  const {locale,planId}=await params
  const result=await getCoachPostgresReviewPlanContext(planId)
  if(result.kind!=='available') notFound()
  const t=await getTranslations({locale,namespace:'CoachPlanning'})
  return (
    <main className='space-y-4'>
      <h1 className='text-2xl font-semibold'>{t('sessionPreview.title')}</h1>
      <p className='text-muted-foreground'>{t('sessionPreview.description')}</p>
      <section aria-label={t('sessionPreview.title')}>
        <h2 className='text-lg font-medium'>{result.plan.title}</h2>
        <p>{t('detail.group',{code:result.plan.groupCategory+result.plan.groupLevel})}</p>
      </section>
    </main>
  )
}
