import Link from 'next/link'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

import { getSessionsByTeam } from '@/app/actions/session-actions'
import { getGroupsByTeam } from '@/app/actions/group-actions'
import { GroupCalendarFilter } from '@/features/sessions/components/GroupCalendarFilter'
import { MonthlySessionCalendar } from '@/features/sessions/components/MonthlySessionCalendar'
import { WeeklySessionCalendar } from '@/features/sessions/components/WeeklySessionCalendar'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface SessionsPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    month?: string | string[]
    view?: string | string[]
    date?: string | string[]
    group?: string | string[]
  }>
}

export default async function SessionsPage({ params, searchParams }: SessionsPageProps) {
  const { locale } = await params
  const query = await searchParams
  const [sessions, groups] = await Promise.all([getSessionsByTeam(), getGroupsByTeam()])
  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`
  const requestedGroupId = typeof query.group === 'string' ? query.group : ''
  const selectedGroup = groups.find((group) => group.id === requestedGroupId)
  const selectedGroupId = selectedGroup?.id ?? ''
  const filteredSessions = selectedGroupId
    ? sessions.filter((session) => session.sessionPrescriptions.some((prescription) => prescription.groupId === selectedGroupId))
    : sessions
  const currentMonth = getCurrentMonthInArgentina()
  const view = query.view === 'week' ? 'week' : 'month'
  const selectedMonth = parseMonth(typeof query.month === 'string' ? query.month : undefined, currentMonth)
  const previousMonth = shiftMonth(selectedMonth, -1)
  const nextMonth = shiftMonth(selectedMonth, 1)
  const monthLabel = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(selectedMonth.year, selectedMonth.month - 1, 1)))
  const selectedDate = parseDate(typeof query.date === 'string' ? query.date : undefined, currentMonth.today)
  const weekStart = getMonday(selectedDate)
  const previousWeek = shiftDate(weekStart, -7)
  const nextWeek = shiftDate(weekStart, 7)
  const weekEnd = shiftDate(weekStart, 6)
  const weekLabel = formatWeekRange(weekStart, weekEnd)
  const monthForViewToggle = view === 'week'
    ? { year: Number(selectedDate.slice(0, 4)), month: Number(selectedDate.slice(5, 7)) }
    : selectedMonth
  const weekDateForViewToggle = view === 'month' && formatMonth(selectedMonth) !== formatMonth(currentMonth)
    ? `${formatMonth(selectedMonth)}-01`
    : selectedDate

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div><h2 className='text-3xl font-bold tracking-tight'>Sesiones</h2><p className='text-muted-foreground'>Entrenamientos programados para el equipo.</p></div>
        <Link href={`${sessionsPath}/new`} className={buttonVariants()}><Plus /> Nueva sesión</Link>
      </div>

      {sessions.length === 0 && (
        <Card><CardHeader><CardTitle>Todavía no hay sesiones</CardTitle><CardDescription>Programá la primera sesión para comenzar a construir el calendario de entrenamiento.</CardDescription></CardHeader></Card>
      )}

      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex w-fit rounded-lg border bg-muted/40 p-1'>
          <Link
            href={buildCalendarHref(sessionsPath, { month: formatMonth(monthForViewToggle), group: selectedGroupId })}
            className={cn(buttonVariants({ variant: view === 'month' ? 'default' : 'ghost', size: 'sm' }), 'gap-2')}
          >
            <CalendarDays /> Mes
          </Link>
          <Link
            href={buildCalendarHref(sessionsPath, { view: 'week', date: weekDateForViewToggle, group: selectedGroupId })}
            className={cn(buttonVariants({ variant: view === 'week' ? 'default' : 'ghost', size: 'sm' }), 'gap-2')}
          >
            <CalendarRange /> Semana
          </Link>
        </div>

        <GroupCalendarFilter groups={groups} selectedGroupId={selectedGroupId} />
      </div>

      {selectedGroup && filteredSessions.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sin sesiones para el grupo {selectedGroup.categoryCode}{selectedGroup.levelCode}</CardTitle>
            <CardDescription>Este grupo todavía no tiene sesiones asignadas en el calendario.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className='space-y-4'>
        <div className='flex items-center justify-between gap-3'>
          <Link
            href={view === 'month'
              ? buildCalendarHref(sessionsPath, { month: formatMonth(previousMonth), group: selectedGroupId })
              : buildCalendarHref(sessionsPath, { view: 'week', date: previousWeek, group: selectedGroupId })}
            className={buttonVariants({ variant: 'outline', size: 'icon' })}
            aria-label={view === 'month' ? 'Mes anterior' : 'Semana anterior'}
          >
            <ChevronLeft />
          </Link>
          <h3 className='text-center text-xl font-semibold capitalize'>{view === 'month' ? monthLabel : weekLabel}</h3>
          <Link
            href={view === 'month'
              ? buildCalendarHref(sessionsPath, { month: formatMonth(nextMonth), group: selectedGroupId })
              : buildCalendarHref(sessionsPath, { view: 'week', date: nextWeek, group: selectedGroupId })}
            className={buttonVariants({ variant: 'outline', size: 'icon' })}
            aria-label={view === 'month' ? 'Mes siguiente' : 'Semana siguiente'}
          >
            <ChevronRight />
          </Link>
        </div>

        {view === 'month' ? (
          <MonthlySessionCalendar
            year={selectedMonth.year}
            month={selectedMonth.month}
            sessions={filteredSessions}
            today={currentMonth.today}
            sessionsPath={sessionsPath}
          />
        ) : (
          <WeeklySessionCalendar
            startDate={weekStart}
            sessions={filteredSessions}
            today={currentMonth.today}
            sessionsPath={sessionsPath}
          />
        )}
      </div>
    </div>
  )
}

interface MonthValue {
  year: number
  month: number
}

function getCurrentMonthInArgentina(): MonthValue & { today: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(values.year),
    month: Number(values.month),
    today: `${values.year}-${values.month}-${values.day}`,
  }
}

function parseMonth(value: string | undefined, fallback: MonthValue): MonthValue {
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  if (!match) return fallback

  const year = Number(match[1])
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? { year, month } : fallback
}

function shiftMonth(value: MonthValue, amount: number): MonthValue {
  const date = new Date(Date.UTC(value.year, value.month - 1 + amount, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

function formatMonth(value: MonthValue) {
  return `${value.year}-${String(value.month).padStart(2, '0')}`
}

function parseDate(value: string | undefined, fallback: string) {
  if (!value?.match(/^\d{4}-\d{2}-\d{2}$/)) return fallback

  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && formatISODate(date) === value ? value : fallback
}

function getMonday(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return formatISODate(date)
}

function shiftDate(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatISODate(date)
}

function formatWeekRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${formatter.format(new Date(`${start}T00:00:00Z`))} – ${formatter.format(new Date(`${end}T00:00:00Z`))}`
}

function formatISODate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildCalendarHref(path: string, values: Record<string, string>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
