import { getTranslations } from 'next-intl/server'

import {
  updateRaceRegistrationLifecycleFormAction,
} from '@/app/actions/race-registration-actions'
import { RaceRegistrationCourseChange } from '@/features/race-registration/components/RaceRegistrationCourseChange'
import { RaceParticipationEditor } from '@/features/race-registration/components/RaceParticipationEditor'
import { RaceRegistrationLifecycleControl } from '@/features/race-registration/components/RaceRegistrationLifecycleControl'
import type { EditionCourseRegistrationsProjection } from '@/lib/competitions/race-registration-application'
import type { RaceCourse } from '@/types/training/race-catalog.types'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

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
                      <RaceRegistrationLifecycleControl
                        locale={locale}
                        registrationId={registration.registrationId}
                        registrationStatus={registration.registrationStatus}
                        athleteName={registration.athleteName ?? registration.athleteProfileId}
                        courseLabel={group.courseLabel}
                        labels={{
                          cancelRegistration: t('cancelRegistration'),
                          reactivateRegistration: t('reactivateRegistration'),
                          cancelConfirmTitle: t('cancelConfirmTitle'),
                          cancelConfirmDescription: t.raw('cancelConfirmDescription'),
                          cancelConfirmAction: t('cancelConfirmAction'),
                          cancelConfirmKeep: t('cancelConfirmKeep'),
                        }}
                      />

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

                  <RaceParticipationEditor
                    key={`${registration.registrationId}:${registration.participationStatus}:${registration.actualDistanceKm ?? 'unknown'}:${registration.elapsedTimeSeconds ?? 'unknown'}`}
                    locale={locale}
                    registrationId={registration.registrationId}
                    participationStatus={registration.participationStatus}
                    actualDistanceKm={registration.actualDistanceKm}
                    elapsedTimeSeconds={registration.elapsedTimeSeconds}
                    labels={{
                      participation: t('participation'),
                      actualDistance: t('actualDistance'),
                      elapsedTime: t('elapsedTime'),
                      saveResult: t('saveResult'),
                      statuses: {
                        unknown: t('participationStatuses.unknown'),
                        started: t('participationStatuses.started'),
                        finished: t('participationStatuses.finished'),
                        dnf: t('participationStatuses.dnf'),
                        dns: t('participationStatuses.dns'),
                      },
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
