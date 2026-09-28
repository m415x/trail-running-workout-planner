import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { GroupForm } from '@/features/groups/components/GroupForm'
import { buttonVariants } from '@ui/button'

interface NewGroupPageProps {
  params: Promise<{ locale: string }>
}

export default async function NewGroupPage({ params }: NewGroupPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanningAudience.sportingGroups' })
  const groupsPath = locale === 'es' ? '/dashboard/groups' : `/${locale}/dashboard/groups`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={groupsPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('back')}
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('newTitle')}</h2>
          <p className='text-muted-foreground'>{t('newDescription')}</p>
        </div>
      </div>
      <GroupForm locale={locale} />
    </div>
  )
}
