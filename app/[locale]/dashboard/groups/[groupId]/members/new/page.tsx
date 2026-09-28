import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getEligibleAthletesForGroup } from '@/app/actions/group-actions'
import { GroupMemberAssignmentForm } from '@/features/groups/components/GroupMemberAssignmentForm'
import { buttonVariants } from '@ui/button'

interface NewGroupMemberPageProps {
  params: Promise<{ locale: string; groupId: string }>
}

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default async function NewGroupMemberPage({ params }: NewGroupMemberPageProps) {
  const { locale, groupId } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanningAudience.sportingGroups' })
  const context = await getEligibleAthletesForGroup(groupId)

  if (!context) {
    notFound()
  }

  const groupCode = `${context.group.categoryCode}${context.group.levelCode}`
  const groupPath = locale === 'es'
    ? `/dashboard/groups/${groupId}`
    : `/${locale}/dashboard/groups/${groupId}`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={groupPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('backToGroup')}
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>
            {t('addMemberTitle', { group: groupCode })}
          </h2>
          <p className='text-muted-foreground'>{t('addMemberDescription')}</p>
        </div>
      </div>

      <GroupMemberAssignmentForm
        locale={locale}
        groupId={groupId}
        groupCode={groupCode}
        athletes={context.athletes}
        defaultEffectiveDate={todayInArgentina()}
      />
    </div>
  )
}
