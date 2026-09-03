import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { WorkoutType } from '@/types/training/workout.types'
import { Badge } from '@ui/badge'
import { Card, CardContent } from '@ui/card'

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const

interface CalendarSession {
  id: string
  date: string
  title: string
  type: WorkoutType
  location: { name: string } | null
}

interface MonthlySessionCalendarProps {
  year: number
  month: number
  sessions: CalendarSession[]
  today: string
}

interface CalendarDay {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
}

export function MonthlySessionCalendar({ year, month, sessions, today }: MonthlySessionCalendarProps) {
  const days = buildCalendarDays(year, month)
  const sessionsByDate = new Map<string, CalendarSession[]>()

  for (const session of sessions) {
    const sessionsForDay = sessionsByDate.get(session.date) ?? []
    sessionsForDay.push(session)
    sessionsByDate.set(session.date, sessionsForDay)
  }

  return (
    <Card className='overflow-hidden py-0'>
      <CardContent className='overflow-x-auto p-0'>
        <div className='min-w-4xl'>
          <div className='grid grid-cols-7 border-b bg-muted/40'>
            {weekDays.map((day) => (
              <div key={day} className='px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                {day}
              </div>
            ))}
          </div>

          <div className='grid grid-cols-7'>
            {days.map((day, index) => {
              const daySessions = sessionsByDate.get(day.date) ?? []
              const isToday = day.date === today

              return (
                <div
                  key={day.date}
                  className={cn(
                    'min-h-32 border-b border-r p-2',
                    index % 7 === 6 && 'border-r-0',
                    index >= days.length - 7 && 'border-b-0',
                    !day.isCurrentMonth && 'bg-muted/25 text-muted-foreground',
                  )}
                >
                  <div className='mb-2 flex items-center justify-between'>
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full text-sm font-medium',
                        isToday && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {day.dayNumber}
                    </span>
                    {daySessions.length > 1 && (
                      <span className='text-xs text-muted-foreground'>{daySessions.length} sesiones</span>
                    )}
                  </div>

                  <div className='space-y-1.5'>
                    {daySessions.map((session) => (
                      <article key={session.id} className='space-y-1 rounded-md border bg-background p-2 shadow-xs'>
                        <div className='flex items-start justify-between gap-2'>
                          <p className='line-clamp-2 text-xs font-semibold leading-snug'>{session.title}</p>
                          <Badge variant='secondary' className='shrink-0 px-1.5 py-0 text-[10px]'>
                            {session.type}
                          </Badge>
                        </div>
                        {session.location && (
                          <p className='flex items-center gap-1 truncate text-[11px] text-muted-foreground'>
                            <MapPin className='size-3 shrink-0' />
                            <span className='truncate'>{session.location.name}</span>
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7
  const calendarStart = new Date(Date.UTC(year, month - 1, 1 - mondayOffset))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const numberOfWeeks = Math.ceil((mondayOffset + daysInMonth) / 7)

  return Array.from({ length: numberOfWeeks * 7 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setUTCDate(calendarStart.getUTCDate() + index)

    return {
      date: formatISODate(date),
      dayNumber: date.getUTCDate(),
      isCurrentMonth: date.getUTCFullYear() === year && date.getUTCMonth() === month - 1,
    }
  })
}

function formatISODate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
