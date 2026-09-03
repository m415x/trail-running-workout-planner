import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { WorkoutType } from '@/types/training/workout.types'
import { Badge } from '@ui/badge'
import { Card, CardContent } from '@ui/card'

interface CalendarSession {
  id: string
  date: string
  title: string
  type: WorkoutType
  location: { name: string } | null
}

interface WeeklySessionCalendarProps {
  startDate: string
  sessions: CalendarSession[]
  today: string
}

export function WeeklySessionCalendar({ startDate, sessions, today }: WeeklySessionCalendarProps) {
  const days = buildWeek(startDate)
  const sessionsByDate = new Map<string, CalendarSession[]>()

  for (const session of sessions) {
    const sessionsForDay = sessionsByDate.get(session.date) ?? []
    sessionsForDay.push(session)
    sessionsByDate.set(session.date, sessionsForDay)
  }

  return (
    <Card className='overflow-hidden py-0'>
      <CardContent className='overflow-x-auto p-0'>
        <div className='grid min-w-4xl grid-cols-7'>
          {days.map((day, index) => {
            const daySessions = sessionsByDate.get(day.date) ?? []
            const isToday = day.date === today

            return (
              <section key={day.date} className={cn('min-h-96 border-r', index === 6 && 'border-r-0')}>
                <header className={cn('border-b bg-muted/40 px-3 py-3 text-center', isToday && 'bg-primary/10')}>
                  <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{day.weekDay}</p>
                  <p
                    className={cn(
                      'mx-auto mt-1 flex size-9 items-center justify-center rounded-full text-lg font-semibold',
                      isToday && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {day.dayNumber}
                  </p>
                  <p className='mt-1 text-xs text-muted-foreground'>{day.monthName}</p>
                </header>

                <div className='space-y-2 p-2'>
                  {daySessions.length === 0 ? (
                    <p className='py-6 text-center text-xs text-muted-foreground'>Sin sesiones</p>
                  ) : (
                    daySessions.map((session) => (
                      <article key={session.id} className='space-y-2 rounded-md border bg-background p-2.5 shadow-xs'>
                        <p className='text-sm font-semibold leading-snug'>{session.title}</p>
                        <Badge variant='secondary' className='text-[10px]'>{session.type}</Badge>
                        {session.location && (
                          <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                            <MapPin className='size-3 shrink-0' />
                            <span className='line-clamp-2'>{session.location.name}</span>
                          </p>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function buildWeek(startDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const weekDayFormatter = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' })
  const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' })

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)

    return {
      date: formatISODate(date),
      dayNumber: date.getUTCDate(),
      weekDay: weekDayFormatter.format(date).replace('.', ''),
      monthName: monthFormatter.format(date).replace('.', ''),
    }
  })
}

function formatISODate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
