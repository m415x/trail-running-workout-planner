import { getTranslations } from 'next-intl/server'

import {
  updateRaceParticipationFormAction,
  updateRaceRegistrationLifecycleFormAction,
} from '@/app/actions/race-registration-actions'
import { RaceRegistrationCourseChange } from '@/features/race-registration/components/RaceRegistrationCourseChange'
import type { EditionCourseRegistrationsProjection } from '@/lib/competitions/race-registration-application'
import type { RaceCourse } from '@/types/training/race-catalog.types'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'

export async function EditionRegistrations({
  editionRegistrationGroups,
  availableCourses,
  locale,
}: {
  editionRegistrationGroups: EditionCourseRegistrationsProjection[]
  availableCourses: RaceCourse[]
  locale: string
}) {
  if (editionRegistrationGroups.length === 0) return null

  const t = await getTranslations('RaceCatalog.registrations')

  return (
    <section className='space-y-3'>
      <div>
        <h3 className='text-xl font-semibold'>{t('editionTitle')}</h3>
        <p className='text-sm text-muted-foreground'>{t('groupedByCourse')}</p>
      </div>

      <div className='space-y-4'>
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
            <CardContent className='space-y-2'>
              {group.registrations.map((registration) => (
                <div key={registration.registrationId} className='grid gap-3 rounded-lg border p-3 text-sm xl:grid-cols-[minmax(10rem,1fr)_minmax(12rem,auto)_minmax(34rem,2fr)] xl:items-center'>
                  <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <span className='font-medium'>{registration.athleteName ?? registration.athleteProfileId}</span>
                    <Badge variant='outline'>{t(`participationStatuses.${registration.participationStatus}`)}</Badge>
                  </div>

                  {registration.participationStatus === 'unknown' && (
                    <div className='flex flex-wrap items-center gap-2'>
                      <form action={updateRaceRegistrationLifecycleFormAction}>
                        <input type='hidden' name='locale' value={locale} />
                        <input type='hidden' name='registrationId' value={registration.registrationId} />
                        <input
                          type='hidden'
                          name='registrationStatus'
                          value={registration.registrationStatus === 'registered' ? 'cancelled' : 'registered'}
                        />
                        <Button type='submit' size='sm' variant='outline'>
                          {registration.registrationStatus === 'registered' ? t('cancelRegistration') : t('reactivateRegistration')}
                        </Button>
                      </form>

                      {registration.registrationStatus === 'registered' && (
                        <RaceRegistrationCourseChange
                          locale={locale}
                          registrationId={registration.registrationId}
                          currentRaceCourseId={registration.raceCourseId}
                          courses={availableCourses.map((course) => ({ id: course.id, label: course.label }))}
                          label={t('changeCourse')}
                        />
                      )}
                    </div>
                  )}

                  <form action={updateRaceParticipationFormAction} className='grid min-w-0 gap-2 sm:grid-cols-[minmax(9rem,1.2fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_auto] sm:items-end'>
                    <input type='hidden' name='locale' value={locale} />
                        <input type='hidden' name='registrationId' value={registration.registrationId} />

                    <label className='grid min-w-0 gap-1'>
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
