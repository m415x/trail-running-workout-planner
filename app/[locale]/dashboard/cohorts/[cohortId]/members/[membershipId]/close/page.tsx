import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getPlanningCohortDetail } from '@/app/actions/planning-cohort-actions'
import { PlanningCohortClosureForm } from '@/features/planning-cohorts/components/PlanningCohortMembershipForms'
import { buttonVariants } from '@ui/button'

interface CloseCohortMembershipPageProps { params: Promise<{ locale: string; cohortId: string; membershipId: string }> }

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export default async function CloseCohortMembershipPage({ params }: CloseCohortMembershipPageProps) {
  const { locale, cohortId, membershipId } = await params
  const cohort = await getPlanningCohortDetail(cohortId)
  const membership = cohort?.memberships.find((candidate) => candidate.id === membershipId && candidate.endDate === null)
  if (!cohort || !membership) notFound()

  const detailPath = locale === 'es' ? `/dashboard/cohorts/${cohortId}` : `/${locale}/dashboard/cohorts/${cohortId}`
  const athleteName = `${membership.athleteProfile.user.firstName} ${membership.athleteProfile.user.lastName}`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={detailPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft /> Volver a la cohorte</Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Retirar atleta</h2>
          <p className='text-muted-foreground'>Cerrá la membresía sin borrar el período ni modificar su grupo deportivo.</p>
        </div>
      </div>
      <PlanningCohortClosureForm
        locale={locale}
        cohortId={cohortId}
        membershipId={membershipId}
        athleteName={athleteName}
        startDate={membership.startDate}
        defaultEndDate={todayInArgentina() < membership.startDate ? membership.startDate : todayInArgentina()}
      />
    </div>
  )
}
