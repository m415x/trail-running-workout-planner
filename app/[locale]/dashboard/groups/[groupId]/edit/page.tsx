import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getGroupById } from '@/app/actions/group-actions'
import { GroupForm } from '@/features/groups/components/GroupForm'
import { buttonVariants } from '@ui/button'

interface EditGroupPageProps {
  params: Promise<{ locale: string; groupId: string }>
}

export default async function EditGroupPage({ params }: EditGroupPageProps) {
  const { locale, groupId } = await params
  const group = await getGroupById(groupId)

  if (!group) notFound()

  const groupsPath = locale === 'es' ? '/dashboard/groups' : `/${locale}/dashboard/groups`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={groupsPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> Volver a grupos
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Editar grupo {group.categoryCode}{group.levelCode}</h2>
          <p className='text-muted-foreground'>Modificá la descripción o el estado operativo del grupo.</p>
        </div>
      </div>
      <GroupForm locale={locale} group={group} />
    </div>
  )
}
