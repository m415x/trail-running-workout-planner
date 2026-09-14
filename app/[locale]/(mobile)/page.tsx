import { getTranslations } from 'next-intl/server'

import { getCurrentAthlete, getWeeklySchedule } from '@/app/actions/dashboard-actions'
import { getCurrentAthleteRealizedTrainingRangeAction } from '@/app/actions/realized-training-actions'
import { HomeTabClient } from '@/app/[locale]/(mobile)/HomeTabClient'

function currentWeekRangeInArgentina() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const today = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`)
  const offset = (today.getUTCDay() + 6) % 7
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - offset)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const format = (date: Date) => date.toISOString().slice(0, 10)
  return { startDate: format(monday), endDate: format(sunday) }
}

export default async function MobileHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'MobileHome' })
  const range = currentWeekRangeInArgentina()

  const [athleteRes, scheduleRes, realizedRes] = await Promise.all([
    getCurrentAthlete(),
    getWeeklySchedule(range.startDate),
    getCurrentAthleteRealizedTrainingRangeAction(range.startDate, range.endDate),
  ])

  if (!athleteRes.success || !scheduleRes.success || !realizedRes.success || !athleteRes.data || !scheduleRes.data) {
    return (
      <div className='flex h-screen items-center justify-center p-4 text-center text-red-500'>
        <p>{t('loadError')}</p>
      </div>
    )
  }

  return (
    <HomeTabClient
      initialAthlete={athleteRes.data}
      initialSchedule={scheduleRes.data}
      initialRealizedTraining={realizedRes.data}
      locale={locale}
    />
  )
}
