import { getTranslations } from 'next-intl/server'
import { CalendarDays, Flag } from 'lucide-react'

import { Link } from '@/i18n/routing'

import { getCurrentAthletePlanningPeriod } from '@/app/actions/dashboard-actions'
import { resolveSelectedAthletePlanWeek, shiftAthletePlanWeek, athletePlanWeekHref } from '@/lib/athlete-planning/plan-week-navigation'
import { selectEffectiveAthletePlanWeek } from '@/lib/athlete-planning/plan-week-detail'
import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'
import { AthleteSessionCard } from '@/features/athlete-planning/components/AthleteSessionCard'
import { AthletePageState } from '@/features/athlete-planning/components/AthletePageState'
import { cn } from '@/lib/utils'
import { resolveApplicationRegionalContext } from '@/lib/regionalization/application-regional-context'
import { Badge } from '@ui/badge'

interface PlanPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ week?: string | string[] }>
}

export default async function PlanPage({ params, searchParams }: PlanPageProps) {
  const { locale } = await params
  const language = locale === 'en' ? 'en' : 'es'
  const t = await getTranslations({ locale, namespace: 'AthletePlan' })
  const regionalContext = resolveApplicationRegionalContext({ language })
  const query = await searchParams
  const civilToday = getCurrentISODateInTimeZone(regionalContext.timeZone)
  const weekValue = typeof query.week === 'string' ? query.week : Array.isArray(query.week) ? 'invalid' : null
  const selected = resolveSelectedAthletePlanWeek(weekValue, civilToday)
  if (selected.status === 'invalid') return <AthletePageState message={t('loadError')} />

  const monday = selected.monday
  const followingMonday = shiftAthletePlanWeek(monday, 1)
  const sunday = formatISODate(new Date(Date.parse(`${followingMonday}T00:00:00Z`) - 86400000))
  const result = await getCurrentAthletePlanningPeriod(monday, sunday)

  if (result.status === 'denied') return <AthletePageState message={t('unauthorized')} />
  if (result.status === 'conflict') return <AthletePageState message={t('loadError')} />
  if (result.status === 'error') return <AthletePageState message={t('loadError')} />

  const effective = selectEffectiveAthletePlanWeek({
    monday,
    effectiveSessions: result.status === 'loaded' ? result.sessions : [],
  })
  if (effective.status === 'error') return <AthletePageState message={t('loadError')} />
  const days = buildWeek(monday, regionalContext.presentationLocale)
  const today = civilToday
  // next-intl Link supplies the locale prefix; preserve selected query via the
  // shared navigation contract using the locale-neutral route pathname.
  const selectedHref = athletePlanWeekHref('/plan?week=' + monday, monday)
  const previousHref = athletePlanWeekHref(selectedHref, shiftAthletePlanWeek(monday, -1))
  const nextHref = athletePlanWeekHref(selectedHref, shiftAthletePlanWeek(monday, 1))
  const currentMonday = resolveSelectedAthletePlanWeek(null, today)
  const currentHref = currentMonday.status === 'resolved'
    ? athletePlanWeekHref(selectedHref, currentMonday.monday)
    : selectedHref

  return (
    <div className='mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6'>
      <header className='space-y-2 px-1 pt-1'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'><p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{t('eyebrow')}</p><h1 className='font-heading text-2xl font-bold leading-tight break-words sm:text-3xl'>{t('currentWeek')}</h1></div>

        </div>
        <p className='flex items-center gap-1.5 text-sm text-muted-foreground'><CalendarDays className='size-4' /> {formatWeekRange(monday, sunday, regionalContext.presentationLocale)}</p>
      </header>

      <nav aria-label='Week navigation' className='flex flex-wrap items-center gap-3 text-sm'>
        <Link href={previousHref} className='rounded-lg border px-3 py-2'>← {language === 'es' ? 'Anterior' : 'Previous'}</Link>
        <Link href={currentHref} className='rounded-lg border px-3 py-2'>{t('today')}</Link>
        <Link href={nextHref} className='rounded-lg border px-3 py-2'>{language === 'es' ? 'Siguiente' : 'Next'} →</Link>
      </nav>

      <Link href='/plan/competition' className='flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between'><span className='flex min-w-0 items-center gap-2'><Flag className='size-4 shrink-0' />{t('competitions')}</span><span className='break-words text-primary'>{t('viewRegistrations')}</span></Link>



      <div className='space-y-3'>
        {days.map((day) => {
          const daySessions = effective.days.find((entry) => entry.date === day.date)?.sessions ?? []
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
