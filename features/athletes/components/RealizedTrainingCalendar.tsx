import { Check, Circle, CircleMinus, CirclePlus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { RealizedTrainingCalendarDay } from '@/app/actions/realized-training-actions'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

interface RealizedTrainingCalendarProps {
  days: readonly RealizedTrainingCalendarDay[]
  startDate: string
  endDate: string
  today: string
  locale: string
}

const statusStyles = {
  completed: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  partial: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  missed: 'border-destructive/50 bg-destructive/10 text-destructive',
  pending: 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  rest: 'border-muted bg-muted/30 text-muted-foreground',
} as const

function StatusIcon({ status }: { status: keyof typeof statusStyles }) {
  if (status === 'completed') return <Check className='size-3.5' />
  if (status === 'partial') return <CircleMinus className='size-3.5' />
  if (status === 'missed') return <X className='size-3.5' />
  return <Circle className='size-3.5' />
}

function enumerateDates(startDate: string, endDate: string) {
  const dates: string[] = []
  const current = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}

export function RealizedTrainingCalendar({
  days,
  startDate,
  endDate,
  today,
  locale,
}: RealizedTrainingCalendarProps) {
  const t = useTranslations('RealizedTrainingCalendar')
  const language = locale === 'en' ? 'en-US' : 'es-AR'
  const byDate = new Map(days.map(day => [day.date, day]))
  const dates = enumerateDates(startDate, endDate)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <p className='text-sm text-muted-foreground'>{t('description')}</p>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground'>
          {dates.slice(0, 7).map(date => (
            <div key={date} className='py-1'>
              {new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
                .format(new Date(`${date}T00:00:00Z`))}
            </div>
          ))}
        </div>
        <div className='mt-1 grid grid-cols-7 gap-1'>
          {dates.map(date => {
            const day = byDate.get(date)
            const dayNumber = Number(date.slice(-2))
            return (
              <div
                key={date}
                className={cn(
                  'min-h-20 rounded-md border p-1.5',
                  date === today && 'ring-2 ring-primary',
                )}
              >
                <p className='text-xs font-semibold'>{dayNumber}</p>
                <div className='mt-1 space-y-1'>
                  {day?.sessions.map(session => (
                    <div
                      key={session.id}
                      title={session.title}
                      aria-label={`${session.title}: ${t(`status.${session.status}`)}`}
                      className={cn(
                        'flex items-center gap-1 rounded border px-1 py-0.5 text-[10px]',
                        statusStyles[session.status],
                      )}
                    >
                      <StatusIcon status={session.status} />
                      <span className='truncate'>{t(`status.${session.status}`)}</span>
                    </div>
                  ))}
                  {day?.hasUnplannedTraining && (
                    <div
                      title={t('extra')}
                      className='flex items-center gap-1 rounded border border-violet-500/50 bg-violet-500/10 px-1 py-0.5 text-[10px] text-violet-700 dark:text-violet-300'
                    >
                      <CirclePlus className='size-3.5' />
                      <span className='truncate'>{t('extra')}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className='mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground'>
          {(['completed', 'partial', 'missed', 'pending'] as const).map(status => (
            <span key={status} className='flex items-center gap-1'>
              <StatusIcon status={status} />
              {t(`status.${status}`)}
            </span>
          ))}
          <span className='flex items-center gap-1'><CirclePlus className='size-3.5' />{t('extra')}</span>
        </div>
      </CardContent>
    </Card>
  )
}
