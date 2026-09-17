import { getTranslations } from 'next-intl/server'

import {
  changeRaceRegistrationCourseAction,
  updateRaceParticipationAction,
  updateRaceRegistrationLifecycleAction,
} from '@/app/actions/race-registration-actions'
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

                  {registration.participationStatus === 'unknown' && (
                    <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                      <form action={updateRaceRegistrationLifecycleAction}>
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
                        <form action={changeRaceRegistrationCourseAction} className='flex gap-2'>
                          <input type='hidden' name='locale' value={locale} />
                        <input type='hidden' name='registrationId' value={registration.registrationId} />
                          <select
                            name='raceCourseId'
                            defaultValue={registration.raceCourseId}
                            className='h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3'
                          >
                            {availableCourses.map((course) => (
                              <option key={course.id} value={course.id}>{course.label}</option>
                            ))}
                          </select>
                          <Button type='submit' size='sm' variant='outline'>{t('changeCourse')}</Button>
                        </form>
                      )}
                    </div>
                  )}

                  <form action={updateRaceParticipationAction} className='mt-3 grid gap-3 sm:grid-cols-2'>
                    <input type='hidden' name='locale' value={locale} />
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
