import { getTranslations } from 'next-intl/server'

import { AthleteForm } from '@/features/athletes/components/AthleteForm'

interface NewAthletePageProps {
  params: Promise<{ locale: string }>
}

export default async function NewAthletePage({ params }: NewAthletePageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AthleteForm' })

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>{t('newPageTitle')}</h2>
        <p className='text-muted-foreground'>{t('newPageDescription')}</p>
      </div>

      <AthleteForm locale={locale} />
    </div>
  )
}
