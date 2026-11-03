'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { ArrowRight, Compass, Users } from 'lucide-react'

import { Link } from '@/i18n/routing'
import { useCoachHomeDestinations } from '@/features/coach-home/coach-home-destinations'
import { selectCoachSidebarDestinations } from '@/components/dashboard/coach-sidebar-destinations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { getCoachHomeActiveAthleteCount } from '@/app/actions/coach-home-actions'
import type { CoachHomeAthleteCountResult } from '@/lib/coach-home/athlete-count-reader'

const WORK_AREAS = [
  { href: '/dashboard/athletes', label: 'athletes' },
  { href: '/dashboard/planning', label: 'planning' },
  { href: '/dashboard/sessions', label: 'sessions' },
  { href: '/dashboard/groups', label: 'groups' },
  { href: '/dashboard/cohorts', label: 'cohorts' },
  { href: '/dashboard/membership', label: 'membership' },
] as const

export default function DashboardPage() {
  const t = useTranslations('CoachHome')
  const [athletes, setAthletes] = useState<CoachHomeAthleteCountResult | { status: 'loading' }>({ status: 'loading' })
  useEffect(() => {
    let active = true
    void getCoachHomeActiveAthleteCount()
      .then((result) => { if (active) setAthletes(result) })
      .catch(() => { if (active) setAthletes({ status: 'error' }) })
    return () => { active = false }
  }, [])
  const visibleDestinations = useCoachHomeDestinations()
  // H3/H4A layout projection determines discoverability. Each destination independently
  // authorizes its data and mutations; this client-side allowlist is never authority.
  const destinations = new Set(selectCoachSidebarDestinations(visibleDestinations))
  const links = WORK_AREAS.filter((area) => destinations.has(area.href))

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <h2 className='text-3xl font-bold tracking-tight'>{t('title')}</h2>
        <p className='text-muted-foreground'>{t('description')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Users aria-hidden='true' className='size-5' /> {t('activeAthletes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {athletes.status === 'ready' ? (
            <p className='text-2xl font-bold' aria-label={t('activeAthletes')}>{athletes.count}</p>
          ) : (
            <p role='status' className='text-sm text-muted-foreground'>
              {athletes.status === 'loading' ? t('athleteStates.loading')
                : t(`athleteStates.${athletes.status}`)}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Compass aria-hidden='true' className='size-5' /> {t('workflows')}
          </CardTitle>
          <CardDescription>{t('dataPending')}</CardDescription>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p role='status' className='text-sm text-muted-foreground'>{t('unavailable')}</p>
          ) : (
            <nav aria-label={t('workflows')} className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {links.map((area) => (
                <Link
                  key={area.href}
                  href={area.href}
                  className='flex min-h-12 items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                >
                  <span>{t(`navigation.${area.label}`)}</span>
                  <ArrowRight aria-hidden='true' className='size-4 shrink-0' />
                </Link>
              ))}
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
