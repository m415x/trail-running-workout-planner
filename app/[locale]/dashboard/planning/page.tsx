import { Link } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, CalendarRange, Plus } from 'lucide-react'

import { getGroupTrainingPlans } from '@/app/actions/planning-actions'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface PlanningPageProps {
  params: Promise<{ locale: string }>
}

export default async function PlanningPage({ params }: PlanningPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanning' })
  const plans = await getGroupTrainingPlans()
  const planningPath = '/dashboard/planning'

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('list.title')}</h2>
          <p className='text-muted-foreground'>{t('list.description')}</p>
        </div>
        <Link href={`${planningPath}/new`} className={buttonVariants()}>
          <Plus /> {t('list.newStrategy')}
        </Link>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('list.emptyTitle')}</CardTitle>
            <CardDescription>{t('list.emptyDescription')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {plans.map((plan) => {
            const groupCode = `${plan.group.categoryCode}${plan.group.levelCode}`
            const macrocycleCount = plan.macrocycles.length
            const microcycleCount = plan.macrocycles.reduce(
              (total, macrocycle) => total + macrocycle.mesocycles.reduce(
                (subtotal, mesocycle) => subtotal + mesocycle.microcycles.length,
                0,
              ),
              0,
            )

            return (
              <Card key={plan.id}>
                <CardHeader>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <CardTitle>{plan.title}</CardTitle>
                      <CardDescription>{t('list.group', { code: groupCode })}</CardDescription>
                    </div>
                    <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                      {t(`list.status.${plan.status}`)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <CalendarRange className='size-4' />
                    {t('list.macrocycles', { count: macrocycleCount })} · {t('list.weeks', { count: microcycleCount })}
                  </div>
                  <div className='flex justify-end'>
                    <Link href={`${planningPath}/${plan.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      {t('list.view')} <ArrowRight />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
