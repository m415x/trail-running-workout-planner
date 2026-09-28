import Link from 'next/link'
import { Pencil, Plus, UsersRound } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getGroupsByTeam } from '@/app/actions/group-actions'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface GroupsPageProps {
  params: Promise<{ locale: string }>
}

export default async function GroupsPage({ params }: GroupsPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanningAudience.sportingGroups' })
  const groups = await getGroupsByTeam()
  const groupsPath = locale === 'es' ? '/dashboard/groups' : `/${locale}/dashboard/groups`

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('title')}</h2>
          <p className='text-muted-foreground'>{t('description')}</p>
        </div>
        <Link href={`${groupsPath}/new`} className={buttonVariants()}><Plus /> {t('new')}</Link>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('emptyTitle')}</CardTitle>
            <CardDescription>{t('emptyDescription')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {groups.map((group) => {
            const code = `${group.categoryCode}${group.levelCode}`
            return (
              <Card key={group.id} className={!group.isActive ? 'opacity-60' : undefined}>
                <CardHeader className='flex-row items-start justify-between gap-4'>
                  <div>
                    <CardTitle className='text-2xl'>{code}</CardTitle>
                    <CardDescription>{group.description || t('noDescription')}</CardDescription>
                  </div>
                  <Badge variant={group.isActive ? 'default' : 'secondary'}>{group.isActive ? t('active') : t('inactive')}</Badge>
                </CardHeader>
                <CardContent className='flex flex-wrap justify-end gap-2'>
                  <Link href={`${groupsPath}/${group.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <UsersRound /> {t('viewMembers')}
                  </Link>
                  <Link href={`${groupsPath}/${group.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <Pencil /> {t('edit')}
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
