import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getAthletesForPlanningCohort } from '@/app/actions/planning-cohort-actions'
import { PlanningCohortAssignmentForm } from '@/features/planning-cohorts/components/PlanningCohortMembershipForms'
import { buttonVariants } from '@ui/button'

interface NewCohortMembershipPageProps { params: Promise<{ locale: string; cohortId: string }> }

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export default async function NewCohortMembershipPage({ params }: NewCohortMembershipPageProps) {
  const { locale, cohortId } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanningAudience.planningSubgroups' })
  const context = await getAthletesForPlanningCohort(cohortId)
  if (!context || context.cohort.status !== 'active') notFound()

  const detailPath = locale === 'es' ? `/dashboard/cohorts/${cohortId}` : `/${locale}/dashboard/cohorts/${cohortId}`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={detailPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft /> {t('backToSubgroup')}</Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('assignPageTitle')}</h2>
          <p className='text-muted-foreground'>{t('assignPageDescription', { name: context.cohort.name })}</p>
        </div>
      </div>
      <PlanningCohortAssignmentForm locale={locale} cohortId={cohortId} athletes={context.athletes} defaultStartDate={todayInArgentina()} />
    </div>
  )
}
