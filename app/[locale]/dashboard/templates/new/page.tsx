import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getWorkoutTemplateFormOptions } from '@/app/actions/workout-template-actions'
import { WorkoutTemplateForm } from '@/features/workout-templates/components/WorkoutTemplateForm'
import { buttonVariants } from '@ui/button'

interface NewWorkoutTemplatePageProps {
  params: Promise<{ locale: string }>
}

export default async function NewWorkoutTemplatePage({ params }: NewWorkoutTemplatePageProps) {
  const [{ locale }, { locations }, t] = await Promise.all([
    params,
    getWorkoutTemplateFormOptions(),
    getTranslations('WorkoutTemplates.form'),
  ])
  const templatesPath = locale === 'es' ? '/dashboard/templates' : `/${locale}/dashboard/templates`

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <div className='space-y-2'>
        <Link href={templatesPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('back')}
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('title')}</h2>
          <p className='text-muted-foreground'>{t('description')}</p>
        </div>
      </div>
      <WorkoutTemplateForm locale={locale} locations={locations} />
    </div>
  )
}
