import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getActiveGroupsForPlanningCohort } from '@/app/actions/planning-cohort-actions'
import { PlanningCohortForm } from '@/features/planning-cohorts/components/PlanningCohortForm'
import { buttonVariants } from '@ui/button'

interface NewPlanningCohortPageProps { params: Promise<{ locale: string }> }

export default async function NewPlanningCohortPage({ params }: NewPlanningCohortPageProps) {
  const { locale } = await params
  const groups = await getActiveGroupsForPlanningCohort()
  const cohortsPath = locale === 'es' ? '/dashboard/cohorts' : `/${locale}/dashboard/cohorts`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={cohortsPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft /> Volver a cohortes</Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Nueva cohorte</h2>
          <p className='text-muted-foreground'>Creá una subdivisión temporal para atletas de un mismo grupo con una planificación compartida.</p>
        </div>
      </div>
      <PlanningCohortForm locale={locale} groups={groups} />
    </div>
  )
}
