import type { EditionCourseRegistrationsProjection } from '@/lib/competitions/race-registration-application'
import { Badge } from '@ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

export function EditionRegistrations({
  editionRegistrationGroups,
}: {
  editionRegistrationGroups: EditionCourseRegistrationsProjection[]
}) {
  if (editionRegistrationGroups.length === 0) {
    return null
  }

  return (
    <section className='space-y-3'>
      <div>
        <h3 className='text-xl font-semibold'>Inscripciones</h3>
        <p className='text-sm text-muted-foreground'>Atletas inscriptos agrupados por recorrido.</p>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        {editionRegistrationGroups.map((group) => (
          <Card key={group.raceCourseId}>
            <CardHeader>
              <CardTitle>{group.courseLabel}</CardTitle>
              <CardDescription>
                {group.nominalDistanceKm == null ? 'Distancia nominal desconocida' : `${group.nominalDistanceKm} km`}
                {' · '}
                {group.nominalElevationGainM == null ? 'D+ desconocido' : `${group.nominalElevationGainM} m+`}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {group.registrations.map((registration) => (
                <div key={registration.registrationId} className='rounded-lg border p-3 text-sm'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <span className='font-medium'>{registration.athleteProfileId}</span>
                    <Badge variant='outline'>{registration.participationStatus}</Badge>
                  </div>
                  <p className='mt-2 text-muted-foreground'>
                    Distancia real: {registration.actualDistanceKm == null ? 'desconocida' : `${registration.actualDistanceKm} km`}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
