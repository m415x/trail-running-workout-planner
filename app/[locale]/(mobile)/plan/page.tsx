import { CalendarDays } from 'lucide-react'

import { getCurrentAthletePlanningWeek } from '@/app/actions/dashboard-actions'
import { AthleteSessionCard } from '@/features/athlete-planning/components/AthleteSessionCard'
import { cn } from '@/lib/utils'
import { Badge } from '@ui/badge'
import { Card, CardContent } from '@ui/card'

export default async function PlanPage() {
  const result = await getCurrentAthletePlanningWeek()

  if (!result.success || !result.data) {
    return <Card className='mt-4'><CardContent className='py-8 text-center text-sm text-destructive'>{result.error ?? 'No se pudo cargar la planificación.'}</CardContent></Card>
  }

  const { athlete, today, startDate, endDate, sessions } = result.data
  const days = buildWeek(startDate)
  const groupCode = athlete.group ? `${athlete.group.categoryCode}${athlete.group.levelCode}` : null

  return (
    <div className='space-y-4 pb-2'>
      <header className='space-y-2 px-1 pt-1'>
        <div className='flex items-start justify-between gap-3'>
          <div><p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Mi planificación</p><h1 className='font-heading text-2xl font-bold'>Semana actual</h1></div>
          {groupCode && <Badge variant='secondary'>Grupo {groupCode}</Badge>}
        </div>
        <p className='flex items-center gap-1.5 text-sm text-muted-foreground'><CalendarDays className='size-4' /> {formatWeekRange(startDate, endDate)}</p>
      </header>

      {!groupCode && <Card><CardContent className='py-6 text-center text-sm text-muted-foreground'>Todavía no tenés un grupo asignado. Consultá con tu entrenador para acceder a tu planificación.</CardContent></Card>}

      <div className='space-y-3'>
        {days.map((day) => {
          const daySessions = sessions.filter((session) => session.date === day.date)
          const isToday = day.date === today

          return (
            <section key={day.date} className={cn('rounded-2xl border bg-card p-3', isToday && 'border-primary/50 ring-1 ring-primary/20')}>
              <div className='mb-3 flex items-center justify-between'>
                <div><p className='font-heading text-base font-bold capitalize'>{day.weekDay}</p><p className='text-xs text-muted-foreground'>{day.dateLabel}</p></div>
                {isToday && <Badge>Hoy</Badge>}
              </div>

              {daySessions.length === 0 ? (
                <p className='rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground'>Sin entrenamiento programado</p>
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

function buildWeek(startDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const weekDayFormatter = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' })
  const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return { date: formatISODate(date), weekDay: weekDayFormatter.format(date), dateLabel: dateFormatter.format(date) }
  })
}

function formatWeekRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${formatter.format(new Date(`${startDate}T00:00:00Z`))} – ${formatter.format(new Date(`${endDate}T00:00:00Z`))}`
}

function formatISODate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
