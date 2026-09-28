import Link from 'next/link'
import { CalendarRange, Eye, Plus, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getPlanningCohortsByTeam } from '@/app/actions/planning-cohort-actions'
import { isPlanningCohortMembershipActiveOn } from '@/lib/planning-cohorts/membership-view'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface PlanningCohortsPageProps {
  params: Promise<{ locale: string }>
}

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default async function PlanningCohortsPage({ params }: PlanningCohortsPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanningAudience.planningSubgroups' })
  const cohorts = await getPlanningCohortsByTeam()
  const cohortsPath = locale === 'es' ? '/dashboard/cohorts' : `/${locale}/dashboard/cohorts`
  const today = todayInArgentina()

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('title')}</h2>
          <p className='text-muted-foreground'>{t('description')}</p>
        </div>
        <Link href={`${cohortsPath}/new`} className={buttonVariants()}><Plus /> {t('new')}</Link>
      </div>

      {cohorts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('emptyTitle')}</CardTitle>
            <CardDescription>
              {t('emptyDescription')}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {cohorts.map((cohort) => {
            const activeMembers = cohort.memberships.filter((membership) => (
              isPlanningCohortMembershipActiveOn(membership, today)
            )).length
            const groupCode = `${cohort.group.categoryCode}${cohort.group.levelCode}`
            const planningVariant = cohort.planningVariant?.isDeleted
              ? null
              : cohort.planningVariant

            return (
              <Card key={cohort.id} className={cohort.status === 'archived' ? 'opacity-70' : undefined}>
                <CardHeader>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <CardTitle>{cohort.name}</CardTitle>
                      <CardDescription className='mt-1'>{cohort.purpose}</CardDescription>
                    </div>
                    <Badge variant={cohort.status === 'active' ? 'default' : 'secondary'}>
                      {cohort.status === 'active' ? t('active') : t('archived')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <p className='text-muted-foreground'>{t('sportingGroup')}</p>
                      <p className='font-medium'>{groupCode}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground'>{t('currentMembers')}</p>
                      <p className='font-medium'>{activeMembers}</p>
                    </div>
                  </div>

                  <div className='flex items-center gap-2 rounded-md border p-3 text-sm'>
                    <CalendarRange className='size-4 text-muted-foreground' />
                    <span className='truncate'>
                      {planningVariant?.title ?? t('noVariant')}
                    </span>
                  </div>

                  <div className='flex justify-end'>
                    <Link
                      href={`${cohortsPath}/${cohort.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <Eye /> {t('viewDetail')}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <p className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Users className='size-4' />
        {t('relationshipHelp')}
      </p>
    </div>
  )
}
