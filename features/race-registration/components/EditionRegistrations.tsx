import { updateRaceParticipationAction } from '@/app/actions/race-registration-actions'
import type { EditionCourseRegistrationsProjection } from '@/lib/competitions/race-registration-application'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'

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

                  <form action={updateRaceParticipationAction} className='mt-3 grid gap-3 sm:grid-cols-2'>
                    <input type='hidden' name='registrationId' value={registration.registrationId} />

                    <label className='grid gap-1'>
                      <span className='text-xs text-muted-foreground'>Participación</span>
                      <select
                        name='participationStatus'
                        defaultValue={registration.participationStatus}
                        className='h-9 rounded-md border border-input bg-background px-3'
                      >
                        <option value='unknown'>Desconocida</option>
                        <option value='started'>Inició</option>
                        <option value='finished'>Finalizó</option>
                        <option value='dnf'>DNF</option>
                        <option value='dns'>DNS</option>
                      </select>
                    </label>

                    <label className='grid gap-1'>
                      <span className='text-xs text-muted-foreground'>Distancia real (km)</span>
                      <Input
                        name='actualDistanceKm'
                        type='number'
                        min='0'
                        step='any'
                        defaultValue={registration.actualDistanceKm ?? ''}
                      />
                    </label>

                    <label className='grid gap-1'>
                      <span className='text-xs text-muted-foreground'>Tiempo transcurrido (s)</span>
                      <Input
                        name='elapsedTimeSeconds'
                        type='number'
                        min='0'
                        step='1'
                        defaultValue={registration.elapsedTimeSeconds ?? ''}
                      />
                    </label>

                    <div className='flex items-end'>
                      <Button type='submit' size='sm'>Guardar resultado</Button>
                    </div>
                  </form>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
