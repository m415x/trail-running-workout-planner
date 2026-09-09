import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getPlanningCohortDetail } from '@/app/actions/planning-cohort-actions'
import { PlanningCohortForm } from '@/features/planning-cohorts/components/PlanningCohortForm'
import { buttonVariants } from '@ui/button'

interface EditPlanningCohortPageProps { params: Promise<{ locale: string; cohortId: string }> }

export default async function EditPlanningCohortPage({ params }: EditPlanningCohortPageProps) {
  const { locale, cohortId } = await params
  const cohort = await getPlanningCohortDetail(cohortId)
  if (!cohort) notFound()

  const cohortPath = locale === 'es' ? `/dashboard/cohorts/${cohort.id}` : `/${locale}/dashboard/cohorts/${cohort.id}`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={cohortPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft /> Volver al detalle</Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Editar cohorte</h2>
          <p className='text-muted-foreground'>Actualizá su identificación operativa sin cambiar el grupo deportivo ni sus integrantes.</p>
        </div>
      </div>
      <PlanningCohortForm locale={locale} groups={[cohort.group]} cohort={cohort} />
    </div>
  )
}
