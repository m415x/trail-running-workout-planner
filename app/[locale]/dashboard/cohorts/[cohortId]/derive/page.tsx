import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getPlanningCohortVariantDerivationContext } from '@/app/actions/planning-cohort-actions'
import { PlanningCohortVariantDerivationForm } from '@/features/planning/components/PlanningCohortVariantDerivationForm'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface PlanningCohortVariantDerivationPageProps {
  params: Promise<{ locale: string; cohortId: string }>
}

export default async function PlanningCohortVariantDerivationPage({
  params,
}: PlanningCohortVariantDerivationPageProps) {
  const { locale, cohortId } = await params
  const t = await getTranslations({ locale, namespace:'CoachPlanningAudience.planningSubgroups' })
  const context = await getPlanningCohortVariantDerivationContext(cohortId)

  if (!context) notFound()

  const cohortPath = locale === 'es'
    ? `/dashboard/cohorts/${cohortId}`
    : `/${locale}/dashboard/cohorts/${cohortId}`

  if (context.cohort.planningVariant) redirect(cohortPath)

  const groupCode = `${context.cohort.group.categoryCode}${context.cohort.group.levelCode}`

  return (
    <div className='mx-auto w-full max-w-4xl space-y-6'>
      <div className='space-y-2'>
        <Link href={cohortPath} className={buttonVariants({ variant:'ghost', size:'sm' })}>
          <ArrowLeft /> {t('backToSubgroup')}
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('deriveVariantTitle')}</h2>
          <p className='text-muted-foreground'>{t('deriveVariantDescription')}</p>
        </div>
      </div>

      {context.cohort.status !== 'active' ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('archived')}</CardTitle>
            <CardDescription>{t('archivedCannotDerive')}</CardDescription>
          </CardHeader>
        </Card>
      ) : context.basePlans.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('noBasePlans')}</CardTitle>
            <CardDescription>{t('noBasePlansDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={cohortPath} className={buttonVariants({ variant:'outline' })}>
              {t('backToSubgroup')}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <PlanningCohortVariantDerivationForm
          locale={locale}
          cohortId={context.cohort.id}
          cohortName={context.cohort.name}
          groupCode={groupCode}
          basePlans={context.basePlans}
        />
      )}
    </div>
  )
}
