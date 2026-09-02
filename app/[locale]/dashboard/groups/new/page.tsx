import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { GroupForm } from '@/features/groups/components/GroupForm'
import { buttonVariants } from '@ui/button'

interface NewGroupPageProps {
  params: Promise<{ locale: string }>
}

export default async function NewGroupPage({ params }: NewGroupPageProps) {
  const { locale } = await params
  const groupsPath = locale === 'es' ? '/dashboard/groups' : `/${locale}/dashboard/groups`

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='space-y-2'>
        <Link href={groupsPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> Volver a grupos
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Nuevo grupo</h2>
          <p className='text-muted-foreground'>Creá un grupo combinando categoría y nivel de entrenamiento.</p>
        </div>
      </div>
      <GroupForm locale={locale} />
    </div>
  )
}
