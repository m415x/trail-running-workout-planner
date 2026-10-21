import { getTranslations } from 'next-intl/server'
import { CalendarDays, Flag } from 'lucide-react'

import { Link } from '@/i18n/routing'

import { getCurrentAthletePlanningPeriod } from '@/app/actions/dashboard-actions'
import { getCurrentAthleteRaceRegistrationsAction } from '@/app/actions/athlete-stats-actions'
import { readAthletePlanCompetitionMilestones } from '@/lib/athlete-planning/plan-competition-context'
import { resolveSelectedAthletePlanWeek, shiftAthletePlanWeek, athletePlanWeekHref } from '@/lib/athlete-planning/plan-week-navigation'
import { selectEffectiveAthletePlanWeek } from '@/lib/athlete-planning/plan-week-detail'
import { projectAthletePlannedWeeklyVolume } from '@/lib/athlete-planning/planned-weekly-volume'
import { buildAthletePlanOverview } from '@/lib/athlete-planning/plan-overview'
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
  if (selected.status === 'invalid') return <AthletePageState message={t('invalidWeek')} />

  const monday = selected.monday
  const currentWeek = resolveSelectedAthletePlanWeek(null, civilToday)
  const currentWeekMonday = currentWeek.status === 'resolved' ? currentWeek.monday : null
  const followingMonday = shiftAthletePlanWeek(monday, 1)
  const sunday = formatISODate(new Date(Date.parse(`${followingMonday}T00:00:00Z`) - 86400000))
  const overviewMondays = [shiftAthletePlanWeek(monday, -1), monday, followingMonday]
  const overviewEnd = formatISODate(new Date(Date.parse(`${shiftAthletePlanWeek(followingMonday, 1)}T00:00:00Z`) - 86400000))
  const result = await getCurrentAthletePlanningPeriod(overviewMondays[0], overviewEnd)

  if (result.status === 'denied') return <AthletePageState message={t('unauthorized')} />
  if (result.status === 'conflict') return <AthletePageState message={t('resolutionConflict')} />
  if (result.status === 'error') return <AthletePageState message={t('loadError')} />

  const effective = selectEffectiveAthletePlanWeek({
    monday,
    effectiveSessions: result.status === 'loaded' ? result.sessions : [],
  })
  if (effective.status === 'error') return <AthletePageState message={t('loadError')} />
  const weeklyVolumes = overviewMondays.map((weekMonday) => {
    const volume = projectAthletePlannedWeeklyVolume(weekMonday, (result.status === 'loaded' ? result.sessions : []).map((session) => ({
      id: session.id,
      date: session.date,
      distanceKm: session.sessionPrescriptions[0]?.distanceKm ?? null,
      elevationGain: session.sessionPrescriptions[0]?.elevationGain ?? null,
    })))
    return { monday: weekMonday, volume }
  })
  if (weeklyVolumes.some((week) => week.volume.status === 'error')) return <AthletePageState message={t('loadError')} />
  const overview = buildAthletePlanOverview({
    selectedMonday: monday,
    effectivePeriods: [], // An authoritative period projection is not yet available; use the dated window.
    weeks: weeklyVolumes.map(({ monday: weekMonday, volume }) => ({
      monday: weekMonday,
      distance: volume.status === 'error' ? { status: 'unknown' as const, value: null } : volume.distance,
      elevationGain: volume.status === 'error' ? { status: 'unknown' as const, value: null } : volume.elevationGain,
    })),
  })
  if (overview.status === 'error') return <AthletePageState message={t('loadError')} />
  const milestoneResult = await readAthletePlanCompetitionMilestones({
    readSelfRegistrations: () => getCurrentAthleteRaceRegistrationsAction({ today: civilToday }),
    explicitPlanGoalRegistrationIds: [], // No authenticated explicit planning-goal relation is available here.
  })
  const maxKnownDistance = Math.max(0, ...overview.weeks.map(week => week.distance.status === 'complete' ? week.distance.value : 0))
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
    <div className='mx-auto w-full min-w-0 max-w-5xl space-y-4 px-4 py-6 sm:px-6'>
      <header className='space-y-2 px-1 pt-1'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'><p className='text-[length:var(--athlete-text-caption)] font-medium uppercase tracking-wide text-muted-foreground'>{t('eyebrow')}</p><h1 className='font-heading text-[length:var(--athlete-text-heading)] font-bold leading-tight break-words'>{monday === currentWeekMonday ? t('currentWeek') : t('selectedWeek')}</h1></div>

        </div>
        <p className='flex items-center gap-1.5 text-[length:var(--athlete-text-body-compact)] text-muted-foreground'><CalendarDays className='size-4' /> {formatWeekRange(monday, sunday, regionalContext.presentationLocale)}</p>
      </header>

      <nav aria-label={t('calendar.selectedWeek')} className='flex flex-wrap items-center gap-3 text-[length:var(--athlete-text-body-compact)]'>
        <Link href={previousHref} className='rounded-lg border px-3 py-2'>← {t('previousWeek')}</Link>
        <Link href={currentHref} className='rounded-lg border px-3 py-2'>{t('today')}</Link>
        <Link href={nextHref} className='rounded-lg border px-3 py-2'>{t('nextWeek')} →</Link>
      </nav>

      <section aria-label={language === 'es' ? 'Panorama multisemana planificado' : 'Planned multiweek overview'} className='space-y-3 rounded-2xl border bg-card p-4'>
        <h2 className='font-heading text-[length:var(--athlete-text-title)] font-bold'>{t('plannedOverview')}</h2>
        <p className='text-[length:var(--athlete-text-body-compact)] text-muted-foreground'>{formatWeekRange(overview.period.startDate, overview.period.endDate, regionalContext.presentationLocale)}</p>
        <ol className='grid gap-3 sm:grid-cols-3' aria-label={language === 'es' ? 'Resumen textual de semanas planificadas' : 'Text summary of planned weeks'}>
          {overview.weeks.map((week) => (
            <li key={week.monday} className='min-w-0 space-y-1 break-words rounded-xl bg-muted/40 p-3 text-[length:var(--athlete-text-body-compact)]'>
              <p className='font-semibold'>{formatWeekRange(week.monday, formatISODate(new Date(Date.parse(`${shiftAthletePlanWeek(week.monday, 1)}T00:00:00Z`) - 86400000)), regionalContext.presentationLocale)}</p>
              <p>{t('plannedDistance')}: {week.distance.status === 'complete' ? `${week.distance.value} km` : week.distance.status === 'incomplete' ? t('incompleteMetric') : t('unknownMetric')}</p>
              <p>{t('plannedAscent')}: {week.elevationGain.status === 'complete' ? `${week.elevationGain.value} m D+` : week.elevationGain.status === 'incomplete' ? (language === 'es' ? 'Datos incompletos' : 'Incomplete data') : (language === 'es' ? 'Sin datos' : 'Unknown')}</p>
              {week.distance.status === 'complete' && <div aria-hidden='true' className='h-1.5 rounded-full bg-primary/20'><div className='h-full max-w-full rounded-full bg-primary' style={{ width: `${maxKnownDistance > 0 ? (week.distance.value / maxKnownDistance) * 100 : 0}%` }} /></div>}
            </li>
          ))}
        </ol>
      </section>

      <section className='space-y-3 rounded-2xl border bg-card p-4' aria-label={language === 'es' ? 'Hitos competitivos' : 'Competition milestones'}>
        <h2 className='font-heading text-[length:var(--athlete-text-title)] font-bold'>{t('competitions')}</h2>
        {milestoneResult.status === 'denied' && <p role='alert' className='text-[length:var(--athlete-text-body-compact)] text-muted-foreground'>{t('unauthorized')}</p>}
        {milestoneResult.status === 'error' && <p role='alert' className='text-[length:var(--athlete-text-body-compact)] text-muted-foreground'>{t('loadError')}</p>}
        {milestoneResult.status === 'loaded' && (milestoneResult.milestones.length === 0
          ? <p className='text-[length:var(--athlete-text-body-compact)] text-muted-foreground'>{t('noUpcomingRegistrations')}</p>
          : <ol className='space-y-2'>{milestoneResult.milestones.map((registration) => (
            <li key={registration.registrationId} className='rounded-xl bg-muted/40 p-3 text-[length:var(--athlete-text-body-compact)]'>
              <p className='font-semibold'>{registration.eventName}</p>
              <p className='text-muted-foreground'>{registration.editionDate} · {registration.editionLabel} · {registration.courseLabel}</p>
              <p className='text-[length:var(--athlete-text-caption)] text-muted-foreground'>{t('registrationMilestone')}</p>
            </li>
          ))}</ol>)}
      </section>

      <Link href='/plan/competition' className='flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-[length:var(--athlete-text-body-compact)] font-semibold sm:flex-row sm:items-center sm:justify-between'><span className='flex min-w-0 items-center gap-2'><Flag className='size-4 shrink-0' />{t('competitions')}</span><span className='break-words text-primary'>{t('viewRegistrations')}</span></Link>



      <div className='space-y-3'>
        {days.map((day) => {
          const daySessions = effective.days.find((entry) => entry.date === day.date)?.sessions ?? []
          const isToday = day.date === today

          return (
            <section key={day.date} className={cn('rounded-2xl border bg-card p-3', isToday && 'border-primary/50 ring-1 ring-primary/20')}>
              <div className='mb-3 flex items-center justify-between'>
                <div><p className='font-heading text-[length:var(--athlete-text-body)] font-bold capitalize'>{day.weekDay}</p><p className='text-[length:var(--athlete-text-caption)] text-muted-foreground'>{day.dateLabel}</p></div>
                {isToday && <Badge>{t('today')}</Badge>}
              </div>

              {daySessions.length === 0 ? (
                <p className='rounded-xl bg-muted/40 px-3 py-4 text-center text-[length:var(--athlete-text-body-compact)] text-muted-foreground'>{t('noTraining')}</p>
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
