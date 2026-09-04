import { getCurrentAthlete, getWeeklySchedule } from '@/app/actions/dashboard-actions'
import { HomeTabClient } from '@/app/[locale]/(mobile)/HomeTabClient'

export default async function MobileHomePage({ params }: { params: Promise<{ locale: string }> }) {
  // ✅ 2. Desempaqueta (await) los params antes de usarlos
  const { locale } = await params
  // 1. Fetch de datos en el servidor (rápido y seguro)
  const [athleteRes, scheduleRes] = await Promise.all([getCurrentAthlete(), getWeeklySchedule()])

  if (!athleteRes.success || !scheduleRes.success || !athleteRes.data || !scheduleRes.data) {
    return (
      <div className='flex h-screen items-center justify-center p-4 text-center text-red-500'>
        <p>Error cargando datos. Asegúrate de haber ejecutado `npm run db:seed`.</p>
      </div>
    )
  }

  // 2. Pasamos los datos iniciales como props al componente cliente
  return (
    <HomeTabClient initialAthlete={athleteRes.data} initialSchedule={scheduleRes.data} locale={locale} />
  )
}
