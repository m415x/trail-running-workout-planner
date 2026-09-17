import { getTranslations } from 'next-intl/server'

import { updateRaceParticipationAction } from '@/app/actions/race-registration-actions'
import type { EditionCourseRegistrationsProjection } from '@/lib/competitions/race-registration-application'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'

export async function EditionRegistrations({
  editionRegistrationGroups,
}: {
  editionRegistrationGroups: EditionCourseRegistrationsProjection[]
}) {
  if (editionRegistrationGroups.length === 0) return null

  const t = await getTranslations('RaceCatalog.registrations')

  return (
    <section className='space-y-3'>
      <div>
        <h3 className='text-xl font-semibold'>{t('editionTitle')}</h3>
        <p className='text-sm text-muted-foreground'>{t('groupedByCourse')}</p>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        {editionRegistrationGroups.map((group) => (
          <Card key={group.raceCourseId}>
            <CardHeader>
              <CardTitle>{group.courseLabel}</CardTitle>
              <CardDescription>
                {group.nominalDistanceKm == null ? t('nominalDistanceUnknown') : `${group.nominalDistanceKm} km`}
                {' · '}
                {group.nominalElevationGainM == null ? t('elevationUnknown') : `${group.nominalElevationGainM} m+`}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {group.registrations.map((registration) => (
                <div key={registration.registrationId} className='rounded-lg border p-3 text-sm'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <span className='font-medium'>{registration.athleteName ?? registration.athleteProfileId}</span>
                    <Badge variant='outline'>{t(`participationStatuses.${registration.participationStatus}`)}</Badge>
                  </div>

                  <form action={updateRaceParticipationAction} className='mt-3 grid gap-3 sm:grid-cols-2'>
                    <input type='hidden' name='registrationId' value={registration.registrationId} />

                    <label className='grid gap-1'>
                      <span className='text-xs text-muted-foreground'>{t('participation')}</span>
                      <select
                        name='participationStatus'
                        defaultValue={registration.participationStatus}
                        className='h-9 rounded-md border border-input bg-background px-3'
                      >
                        <option value='unknown'>{t('participationStatuses.unknown')}</option>
                        <option value='started'>{t('participationStatuses.started')}</option>
                        <option value='finished'>{t('participationStatuses.finished')}</option>
                        <option value='dnf'>{t('participationStatuses.dnf')}</option>
                        <option value='dns'>{t('participationStatuses.dns')}</option>
                      </select>
                    </label>

                    <label className='grid gap-1'>
                      <span className='text-xs text-muted-foreground'>{t('actualDistance')}</span>
                      <Input
                        name='actualDistanceKm'
                        type='number'
                        min='0'
                        step='any'
                        defaultValue={registration.actualDistanceKm ?? ''}
                      />
                    </label>

                    <label className='grid gap-1'>
                      <span className='text-xs text-muted-foreground'>{t('elapsedTime')}</span>
                      <Input
                        name='elapsedTimeSeconds'
                        type='number'
                        min='0'
                        step='1'
                        defaultValue={registration.elapsedTimeSeconds ?? ''}
                      />
                    </label>

                    <div className='flex items-end'>
                      <Button type='submit' size='sm'>{t('saveResult')}</Button>
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
