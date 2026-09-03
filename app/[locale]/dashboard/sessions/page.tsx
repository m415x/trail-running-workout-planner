import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

import { getSessionsByTeam } from '@/app/actions/session-actions'
import { MonthlySessionCalendar } from '@/features/sessions/components/MonthlySessionCalendar'
import { buttonVariants } from '@ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface SessionsPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ month?: string | string[] }>
}

export default async function SessionsPage({ params, searchParams }: SessionsPageProps) {
  const { locale } = await params
  const query = await searchParams
  const sessions = await getSessionsByTeam()
  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`
  const currentMonth = getCurrentMonthInArgentina()
  const selectedMonth = parseMonth(typeof query.month === 'string' ? query.month : undefined, currentMonth)
  const previousMonth = shiftMonth(selectedMonth, -1)
  const nextMonth = shiftMonth(selectedMonth, 1)
  const monthLabel = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(selectedMonth.year, selectedMonth.month - 1, 1)))

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div><h2 className='text-3xl font-bold tracking-tight'>Sesiones</h2><p className='text-muted-foreground'>Entrenamientos programados para el equipo.</p></div>
        <Link href={`${sessionsPath}/new`} className={buttonVariants()}><Plus /> Nueva sesión</Link>
      </div>

      {sessions.length === 0 && (
        <Card><CardHeader><CardTitle>Todavía no hay sesiones</CardTitle><CardDescription>Programá la primera sesión para comenzar a construir el calendario de entrenamiento.</CardDescription></CardHeader></Card>
      )}

      <div className='space-y-4'>
        <div className='flex items-center justify-between gap-3'>
          <Link
            href={`${sessionsPath}?month=${formatMonth(previousMonth)}`}
            className={buttonVariants({ variant: 'outline', size: 'icon' })}
            aria-label='Mes anterior'
          >
            <ChevronLeft />
          </Link>
          <h3 className='text-xl font-semibold capitalize'>{monthLabel}</h3>
          <Link
            href={`${sessionsPath}?month=${formatMonth(nextMonth)}`}
            className={buttonVariants({ variant: 'outline', size: 'icon' })}
            aria-label='Mes siguiente'
          >
            <ChevronRight />
          </Link>
        </div>

        <MonthlySessionCalendar
          year={selectedMonth.year}
          month={selectedMonth.month}
          sessions={sessions}
          today={currentMonth.today}
        />
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
