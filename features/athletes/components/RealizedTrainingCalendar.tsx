'use client'

import { useState } from 'react'
import { Check, Circle, CircleMinus, CirclePlus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { RealizedTrainingCalendarDay } from '@/app/actions/realized-training-actions'
import { cn } from '@/lib/utils'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@ui/accordion'
import { Badge } from '@ui/badge'
import { Card } from '@ui/card'

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const selectedDay = selectedDate ? byDate.get(selectedDate) : undefined

  const formatSelectedDate = (date: string) => new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))

  return (
    <Card className='py-0'>
      <Accordion className='w-full'>
        <AccordionItem value='realized-training-calendar' className='border-none'>
          <AccordionTrigger className='px-6 py-5 hover:no-underline'>
            <div className='min-w-0 pr-4'>
              <h3 className='text-base font-semibold'>{t('title')}</h3>
              <p className='mt-1 text-sm font-normal text-muted-foreground'>{t('description')}</p>
            </div>
          </AccordionTrigger>

          <AccordionContent className='px-6 pb-6 [&_a]:no-underline [&_a:hover]:no-underline'>
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
                const selected = date === selectedDate
                const isToday = date === today

                return (
                  <div
                    key={date}
                    className={cn(
                      'min-h-20 rounded-md border p-1.5 transition-colors',
                      selected && 'border-primary',
                    )}
                  >
                    <button
                      type='button'
                      onClick={() => setSelectedDate(date)}
                      aria-pressed={selected}
                      aria-label={formatSelectedDate(date)}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-lg text-xs font-semibold transition-all',
                        !isToday && 'hover:bg-secondary/60',
                        isToday && 'bg-primary font-bold text-primary-foreground shadow-sm',
                      )}
                    >
                      {dayNumber}
                    </button>
                    <div className='mt-1 space-y-1'>
                      {day?.sessions.map(session => {
                        const content = (
                          <>
                            <StatusIcon status={session.status} />
                            <span className='truncate'>{t(`status.${session.status}`)}</span>
                          </>
                        )
                        const className = cn(
                          'flex items-center gap-1 rounded border px-1 py-0.5 text-[10px] no-underline hover:no-underline',
                          statusStyles[session.status],
                          session.recordId && 'hover:ring-2 hover:ring-primary/30',
                        )

                        return session.recordId ? (
                          <a
                            key={session.id}
                            href={`#realized-training-${session.recordId}`}
                            title={`${session.title} · ${t('openRecord')}`}
                            aria-label={`${session.title}: ${t(`status.${session.status}`)}. ${t('openRecord')}`}
                            className={className}
                            onClick={() => setSelectedDate(date)}
                          >
                            {content}
                          </a>
                        ) : (
                          <button
                            type='button'
                            key={session.id}
                            title={session.title}
                            aria-label={`${session.title}: ${t(`status.${session.status}`)}`}
                            className={cn(className, 'w-full')}
                            onClick={() => setSelectedDate(date)}
                          >
                            {content}
                          </button>
                        )
                      })}
                      {day?.unplannedRecordIds.map((recordId, index) => (
                        <a
                          key={recordId}
                          href={`#realized-training-${recordId}`}
                          title={t('openRecord')}
                          className='flex items-center gap-1 rounded border border-violet-500/50 bg-violet-500/10 px-1 py-0.5 text-[10px] text-violet-700 no-underline hover:no-underline hover:ring-2 hover:ring-primary/30 dark:text-violet-300'
                          onClick={() => setSelectedDate(date)}
                        >
                          <CirclePlus className='size-3.5' />
                          <span className='truncate'>
                            {day.unplannedRecordIds.length > 1 ? `${t('extra')} ${index + 1}` : t('extra')}
                          </span>
                        </a>
                      ))}
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

            {selectedDate && (
              <div className='mt-5 rounded-lg border bg-muted/20 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p className='font-medium capitalize'>{formatSelectedDate(selectedDate)}</p>
                  {selectedDate === today && (
                    <Badge variant='outline' className='border-primary/50 text-primary'>
                      {locale === 'en' ? 'Today' : 'Hoy'}
                    </Badge>
                  )}
                </div>

                {selectedDay && (selectedDay.sessions.length > 0 || selectedDay.unplannedRecordIds.length > 0) ? (
                  <div className='mt-3 space-y-2'>
                    {selectedDay.sessions.map(session => (
                      <div key={session.id} className='flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 p-3'>
                        <div className='min-w-0'>
                          <p className='truncate font-medium'>{session.title}</p>
                          <span className={cn('mt-1 inline-flex items-center gap-1 text-xs', statusStyles[session.status].split(' ').filter(value => value.startsWith('text-')).join(' '))}>
                            <StatusIcon status={session.status} />
                            {t(`status.${session.status}`)}
                          </span>
                        </div>
                        {session.recordId && (
                          <a
                            href={`#realized-training-${session.recordId}`}
                            className='text-xs font-medium text-primary no-underline hover:no-underline'
                          >
                            {t('openRecord')}
                          </a>
                        )}
                      </div>
                    ))}
                    {selectedDay.unplannedRecordIds.map((recordId, index) => (
                      <div key={recordId} className='flex items-center justify-between gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-3'>
                        <span className='flex items-center gap-2 text-sm'>
                          <CirclePlus className='size-4 text-violet-600 dark:text-violet-300' />
                          {selectedDay.unplannedRecordIds.length > 1 ? `${t('extra')} ${index + 1}` : t('extra')}
                        </span>
                        <a
                          href={`#realized-training-${recordId}`}
                          className='text-xs font-medium text-primary no-underline hover:no-underline'
                        >
                          {t('openRecord')}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='mt-2 text-sm text-muted-foreground'>
                    {locale === 'en' ? 'No training scheduled or recorded for this day.' : 'No hay entrenamientos planificados ni registrados para este día.'}
                  </p>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
