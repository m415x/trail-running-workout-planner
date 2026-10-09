import { getTranslations } from 'next-intl/server'
import { CalendarDays, Flag } from 'lucide-react'

import { Link } from '@/i18n/routing'

import { getCurrentAthletePlanningWeek } from '@/app/actions/dashboard-actions'
import { AthleteSessionCard } from '@/features/athlete-planning/components/AthleteSessionCard'
import { AthletePageState } from '@/features/athlete-planning/components/AthletePageState'
import { cn } from '@/lib/utils'
import { resolveApplicationRegionalContext } from '@/lib/regionalization/application-regional-context'
import { Badge } from '@ui/badge'
import { Card, CardContent } from '@ui/card'

interface PlanPageProps {
  params: Promise<{ locale: string }>
}

export default async function PlanPage({ params }: PlanPageProps) {
  const { locale } = await params
  const language = locale === 'en' ? 'en' : 'es'
  const t = await getTranslations({ locale, namespace: 'AthletePlan' })
  const regionalContext = resolveApplicationRegionalContext({ language })
  const result = await getCurrentAthletePlanningWeek()

  if (!result.success || !result.data) {
    return <AthletePageState message={result.status === 'unauthorized' ? t('unauthorized') : t('loadError')} />
  }

  const { athlete, today, startDate, endDate, sessions } = result.data
  const days = buildWeek(startDate, regionalContext.presentationLocale)
  const groupCode = athlete.group ? `${athlete.group.categoryCode}${athlete.group.levelCode}` : null

  return (
    <div className='mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6'>
      <header className='space-y-2 px-1 pt-1'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'><p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{t('eyebrow')}</p><h1 className='font-heading text-2xl font-bold leading-tight break-words sm:text-3xl'>{t('currentWeek')}</h1></div>
          {groupCode && <Badge variant='secondary' className='shrink-0'>{t('group', { group: groupCode })}</Badge>}
        </div>
        <p className='flex items-center gap-1.5 text-sm text-muted-foreground'><CalendarDays className='size-4' /> {formatWeekRange(startDate, endDate, regionalContext.presentationLocale)}</p>
      </header>

      <Link href='/plan/competition' className='flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between'><span className='flex min-w-0 items-center gap-2'><Flag className='size-4 shrink-0' />{t('competitions')}</span><span className='break-words text-primary'>{t('viewRegistrations')}</span></Link>

      {!groupCode && <Card><CardContent className='py-6 text-center text-sm text-muted-foreground'>{t('noGroup')}</CardContent></Card>}

      <div className='space-y-3'>
        {days.map((day) => {
          const daySessions = sessions.filter((session) => session.date === day.date)
          const isToday = day.date === today

          return (
            <section key={day.date} className={cn('rounded-2xl border bg-card p-3', isToday && 'border-primary/50 ring-1 ring-primary/20')}>
              <div className='mb-3 flex items-center justify-between'>
                <div><p className='font-heading text-base font-bold capitalize'>{day.weekDay}</p><p className='text-xs text-muted-foreground'>{day.dateLabel}</p></div>
                {isToday && <Badge>{t('today')}</Badge>}
              </div>

              {daySessions.length === 0 ? (
                <p className='rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground'>{t('noTraining')}</p>
              ) : (
                <div className='space-y-2'>
                  {daySessions.map((session) => {
                    const prescription = session.sessionPrescriptions[0]
                    return <AthleteSessionCard key={session.id} session={session} prescription={prescription} />
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function buildWeek(startDate: string, presentationLocale: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const weekDayFormatter = new Intl.DateTimeFormat(presentationLocale, { weekday: 'long', timeZone: 'UTC' })
  const dateFormatter = new Intl.DateTimeFormat(presentationLocale, { day: 'numeric', month: 'long', timeZone: 'UTC' })

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return { date: formatISODate(date), weekDay: weekDayFormatter.format(date), dateLabel: dateFormatter.format(date) }
  })
}

function formatWeekRange(startDate: string, endDate: string, presentationLocale: string) {
  const formatter = new Intl.DateTimeFormat(presentationLocale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${formatter.format(new Date(`${startDate}T00:00:00Z`))} – ${formatter.format(new Date(`${endDate}T00:00:00Z`))}`
}

function formatISODate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
