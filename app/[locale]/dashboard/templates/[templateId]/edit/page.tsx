import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { getWorkoutTemplateById, getWorkoutTemplateFormOptions } from '@/app/actions/workout-template-actions'
import { WorkoutTemplateForm } from '@/features/workout-templates/components/WorkoutTemplateForm'
import { buttonVariants } from '@ui/button'

interface EditWorkoutTemplatePageProps {
  params: Promise<{ locale: string; templateId: string }>
}

export default async function EditWorkoutTemplatePage({ params }: EditWorkoutTemplatePageProps) {
  const { locale, templateId } = await params
  const [template, { locations }, t] = await Promise.all([
    getWorkoutTemplateById(templateId),
    getWorkoutTemplateFormOptions(),
    getTranslations('WorkoutTemplates.form'),
  ])
  if (!template) notFound()

  const templatesPath = locale === 'es' ? '/dashboard/templates' : `/${locale}/dashboard/templates`

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <div className='space-y-2'>
        <Link href={templatesPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('back')}
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('editTitle')}</h2>
          <p className='text-muted-foreground'>{t('editDescription')}</p>
        </div>
      </div>
      <WorkoutTemplateForm locale={locale} locations={locations} template={template} />
    </div>
  )
}
