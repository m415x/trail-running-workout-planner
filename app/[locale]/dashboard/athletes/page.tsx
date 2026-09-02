import Link from 'next/link'
import { Plus } from 'lucide-react'

import { getAthletesByTeam } from '@/app/actions/athlete-actions'
import { AthletesEmptyState } from '@/features/athletes/components/AthletesEmptyState'
import { AthletesTable } from '@/features/athletes/components/AthletesTable'
import { buttonVariants } from '@ui/button'

interface AthletesPageProps {
  params: Promise<{ locale: string }>
}

export default async function AthletesPage({ params }: AthletesPageProps) {
  const { locale } = await params
  const result = await getAthletesByTeam()
  const newAthletePath = locale === 'es' ? '/dashboard/athletes/new' : `/${locale}/dashboard/athletes/new`

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Atletas</h2>
          <p className='text-muted-foreground'>Perfiles activos y grupo actual de cada integrante del equipo.</p>
        </div>

        <Link href={newAthletePath} className={buttonVariants()}>
          <Plus />
          Nuevo atleta
        </Link>
      </div>

      {!result.success ? (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
          {result.error}
        </div>
      ) : result.data.length === 0 ? (
        <AthletesEmptyState />
      ) : (
        <AthletesTable athletes={result.data} locale={locale} />
      )}
    </div>
  )
}
