import { AthleteForm } from '@/features/athletes/components/AthleteForm'

interface NewAthletePageProps {
  params: Promise<{ locale: string }>
}

export default async function NewAthletePage({ params }: NewAthletePageProps) {
  const { locale } = await params

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>Nuevo atleta</h2>
        <p className='text-muted-foreground'>Creá el perfil del atleta. La asignación de grupo se gestiona por separado.</p>
      </div>

      <AthleteForm locale={locale} />
    </div>
  )
}
