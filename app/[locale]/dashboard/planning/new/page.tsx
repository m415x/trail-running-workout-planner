import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getCoachPlanningCreationEligibility } from '@/app/actions/load-strategy-actions'
import { addDays, format, parseISO } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

import { getActiveAthleteGroups } from '@/app/actions/athlete-actions'
import { LoadStrategyForm } from '@/features/planning/components/LoadStrategyForm'
import type { AthleteGroupCode } from '@/types'
import { buttonVariants } from '@ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface NewPlanningPageProps {
  params: Promise<{ locale: string }>
}

function todayInBuenosAires() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

export default async function NewPlanningPage({ params }: NewPlanningPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanning' })
  const creationAllowed = await getCoachPlanningCreationEligibility()
  if (!creationAllowed) {
    return (
      <div className='mx-auto w-full max-w-5xl space-y-4'>
        <Link href={locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('newStrategyPage.back')}
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{t('newStrategyPage.deniedTitle')}</CardTitle>
            <CardDescription>{t('newStrategyPage.deniedDescription')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }
  const groups = await getActiveAthleteGroups()
  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  const defaultStartDate = parseISO(todayInBuenosAires())
  const defaultEndDate = addDays(defaultStartDate, 83)

  return (
    <div className='mx-auto w-full max-w-5xl space-y-6'>
      <div className='space-y-2'>
        <Link href={planningPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('newStrategyPage.back')}
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('newStrategyPage.title')}</h2>
          <p className='text-muted-foreground'>{t('newStrategyPage.description')}</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('newStrategyPage.noGroupsTitle')}</CardTitle>
            <CardDescription>{t('newStrategyPage.noGroupsDescription')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <LoadStrategyForm
          locale={locale}
          defaultStartDate={format(defaultStartDate, 'yyyy-MM-dd')}
          defaultEndDate={format(defaultEndDate, 'yyyy-MM-dd')}
          groups={groups.map((group) => ({
            id: group.id,
            code: `${group.categoryCode}${group.levelCode}` as AthleteGroupCode,
            description: group.description,
          }))}
        />
      )}
    </div>
  )
}
