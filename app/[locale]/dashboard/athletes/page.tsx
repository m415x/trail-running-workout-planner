import { getAthletesByTeam } from '@/app/actions/athlete-actions'
import { AthletesEmptyState } from '@/features/athletes/components/AthletesEmptyState'
import { AthletesTable } from '@/features/athletes/components/AthletesTable'

export default async function AthletesPage() {
  const result = await getAthletesByTeam()

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>Atletas</h2>
        <p className='text-muted-foreground'>Perfiles activos y grupo actual de cada integrante del equipo.</p>
      </div>

      {!result.success ? (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
          {result.error}
        </div>
      ) : result.data.length === 0 ? (
        <AthletesEmptyState />
      ) : (
        <AthletesTable athletes={result.data} />
      )}
    </div>
  )
}
