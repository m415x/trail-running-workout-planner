import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { AthleteForm } from '@/features/athletes/components/AthleteForm'

interface EditAthletePageProps {
  params: Promise<{ locale: string; athleteId: string }>
}

export default async function EditAthletePage({ params }: EditAthletePageProps) {
  const { locale, athleteId } = await params
  const athlete = await getAthleteById(athleteId)
  const t = await getTranslations({ locale, namespace: 'AthleteEditPage' })

  if (!athlete) {
    notFound()
  }

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>{t('title')}</h2>
        <p className='text-muted-foreground'>{t('description')}</p>
      </div>

      <AthleteForm
        locale={locale}
        athlete={{
          id: athlete.id,
          firstName: athlete.user.firstName,
          lastName: athlete.user.lastName,
          email: athlete.user.email,
          dni: athlete.dni,
          nickName: athlete.nickName,
          birthday: athlete.birthday,
          phone: athlete.phone,
          emergencyContact: athlete.emergencyContact,
          emergencyPhone: athlete.emergencyPhone,
        }}
      />
    </div>
  )
}
