import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getSessionFormOptions } from '@/app/actions/session-actions'
import { SessionForm } from '@/features/sessions/components/SessionForm'
import { buttonVariants } from '@ui/button'

interface NewSessionPageProps {
  params: Promise<{ locale: string }>
}

export default async function NewSessionPage({ params }: NewSessionPageProps) {
  const { locale } = await params
  const t = await getTranslations('Sessions')
  const { workouts, locations, groups } = await getSessionFormOptions()
  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`

  return (
    <div className='mx-auto w-full max-w-4xl space-y-6'>
      <div className='space-y-2'>
        <Link href={sessionsPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('routes.create.back')}
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('routes.create.title')}</h2>
          <p className='text-muted-foreground'>{t('routes.create.description')}</p>
        </div>
      </div>

      <SessionForm locale={locale} workouts={workouts} locations={locations} groups={groups} />
    </div>
  )
}
