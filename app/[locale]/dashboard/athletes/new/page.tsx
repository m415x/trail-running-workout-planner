import { getActiveAthleteGroups } from '@/app/actions/athlete-actions'
import { AthleteForm } from '@/features/athletes/components/AthleteForm'

interface NewAthletePageProps {
  params: Promise<{ locale: string }>
}

export default async function NewAthletePage({ params }: NewAthletePageProps) {
  const { locale } = await params
  const groups = await getActiveAthleteGroups()

  groups.sort((first, second) => {
    const firstCode = `${first.categoryCode}${first.levelCode}`
    const secondCode = `${second.categoryCode}${second.levelCode}`
    return firstCode.localeCompare(secondCode)
  })

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>Nuevo atleta</h2>
        <p className='text-muted-foreground'>Creá el perfil y, si corresponde, asignalo a su grupo actual.</p>
      </div>

      <AthleteForm locale={locale} groups={groups} />
    </div>
  )
}
