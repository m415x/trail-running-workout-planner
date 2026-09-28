import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getActiveGroupsForPlanningCohort } from '@/app/actions/planning-cohort-actions'
import { PlanningCohortForm } from '@/features/planning-cohorts/components/PlanningCohortForm'
import { buttonVariants } from '@ui/button'

interface NewPlanningCohortPageProps { params: Promise<{ locale: string }> }

export default async function NewPlanningCohortPage({ params }: NewPlanningCohortPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanningAudience.planningSubgroups' })
  const groups = await getActiveGroupsForPlanningCohort()
  const cohortsPath = locale === 'es' ? '/dashboard/cohorts' : `/${locale}/dashboard/cohorts`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={cohortsPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft /> {t('back')}</Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('newTitle')}</h2>
          <p className='text-muted-foreground'>{t('newDescription')}</p>
        </div>
      </div>
      <PlanningCohortForm locale={locale} groups={groups} />
    </div>
  )
}
