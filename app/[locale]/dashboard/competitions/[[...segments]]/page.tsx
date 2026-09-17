import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  MapPin,
  Mountain,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'

import { CatalogForm } from '@/features/race-catalog/components/CatalogForm'
import { CourseRegistration } from '@/features/race-registration/components/CourseRegistration'
import { Link } from '@/i18n/routing'
import {
  getRaceCourse,
  getRaceEdition,
  getRaceEvent,
  listRaceCourses,
  listRaceEditions,
  listRaceEvents,
} from '@/lib/race-catalog/catalog-repository'
import { deriveRaceCourseProfile } from '@/lib/race-catalog/race-course-derived-profile'
import { loadCourseRegistrationData } from '@/lib/competitions/race-registration-course-query'
import {
  listActiveCourseRegistrationAthletes,
  listEffectiveCourseRegistrationsInEdition,
} from '@/lib/competitions/race-registration-course-sources'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'

interface Props {
  params: Promise<{ locale: string; segments?: string[] }>
  searchParams: Promise<{ q?: string; archived?: string }>
}

export default async function CompetitionsPage({ params, searchParams }: Props) {
  const { locale, segments = [] } = await params
  const query = await searchParams
  const t = await getTranslations({ locale, namespace: 'RaceCatalog' })
  const base = '/dashboard/competitions'

  const date = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC' })
    .format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
  const metric = (value: number | null | undefined, unit: string) => value == null
    ? t('unknown')
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${unit}`
  const scheduledStart = (value: string | null | undefined) => {
    if (!value) return t('unknown')
    const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2})?([+-]\d{2}:\d{2}|Z)?$/)
    if (!match) return value

    const [, localDate, hours, minutes, offset] = match
    const zone = offset === 'Z' ? 'UTC' : offset ? `UTC${offset}` : null
    return [date(localDate), `${hours}:${minutes}`, zone].filter(Boolean).join(' · ')
  }
  const sourceLabel = (record: { source?: { origin: string; provider?: string | null; externalId?: string | null } }) => (
    record.source?.origin === 'external'
      ? [t('external'), record.source.provider, record.source.externalId].filter(Boolean).join(' · ')
      : t('product')
  )

  if (segments.length === 0) {
    const q = typeof query.q === 'string' ? query.q.slice(0, 200) : ''
    const events = listRaceEvents(q, query.archived === '1')

    return (
      <div className='space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h2 className='text-3xl font-bold tracking-tight'>{t('navigation')}</h2>
            <p className='text-muted-foreground'>{t('intro')}</p>
          </div>
          <Link href={`${base}/new`} className={buttonVariants()}>
            <Plus /> {t('newEvent')}
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>{t('searchEvents')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className='flex flex-col gap-3 sm:flex-row sm:items-end'>
              <div className='min-w-0 flex-1 space-y-1.5'>
                <label htmlFor='q' className='text-sm font-medium'>{t('searchEvents')}</label>
                <Input id='q' name='q' defaultValue={q} maxLength={200} />
              </div>
              <label className='flex h-8 items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  name='archived'
                  value='1'
                  defaultChecked={query.archived === '1'}
                  className='size-4 rounded border-input'
                />
                {t('includeArchived')}
              </label>
              <button className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Search /> {t('search')}
              </button>
            </form>
          </CardContent>
        </Card>

        {events.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('emptyEvents')}</CardTitle>
              <CardDescription>{t('intro')}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {events.map((event) => (
              <Card key={event.id} className={event.status === 'archived' ? 'opacity-60' : undefined}>
                <CardHeader className='flex-row items-start justify-between gap-4'>
                  <div className='min-w-0'>
                    <CardTitle className='text-xl'>{event.name}</CardTitle>
                    <CardDescription className='line-clamp-2'>
                      {event.description || `${t('source')}: ${sourceLabel(event)}`}
                    </CardDescription>
                  </div>
                  <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                    {t(`statuses.${event.status}`)}
                  </Badge>
                </CardHeader>
                <CardContent className='flex items-center justify-between gap-3'>
                  <span className='truncate text-xs text-muted-foreground'>{t('source')}: {sourceLabel(event)}</span>
                  <Link href={`${base}/${event.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    {t('editions')} <ChevronRight />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (segments.length === 1 && segments[0] === 'new') {
    return <FormPage title={t('newEvent')} backPath={base} backLabel={t('navigation')}>
      <CatalogForm kind='event' locale={locale} backPath={base} />
    </FormPage>
  }

  const event = getRaceEvent(segments[0])
  if (!event || event.isDeleted) notFound()
  const eventPath = `${base}/${event.id}`

  if (segments.length === 2 && ['edit', 'archive'].includes(segments[1])) {
    const archive = segments[1] === 'archive'
    return <FormPage title={`${t(archive ? 'archive' : 'edit')}: ${event.name}`} backPath={eventPath} backLabel={event.name}>
      <CatalogForm kind='event' locale={locale} event={event} backPath={eventPath} archive={archive} />
    </FormPage>
  }

  if (segments.length === 1) {
    const editions = listRaceEditions(event.id)
    return (
      <div className='space-y-6'>
        <DetailHeader backPath={base} backLabel={t('navigation')} title={event.name}>
          <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>{t(`statuses.${event.status}`)}</Badge>
        </DetailHeader>

        <Card>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle>{event.name}</CardTitle>
                <CardDescription>{event.description || `${t('source')}: ${sourceLabel(event)}`}</CardDescription>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Link href={`${eventPath}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Pencil /> {t('edit')}
                </Link>
                {event.status !== 'archived' && (
                  <Link href={`${eventPath}/archive`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <Archive /> {t('archive')}
                  </Link>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            {event.websiteUrl && <p>{t('fields.websiteUrl')}: {event.websiteUrl}</p>}
            <p className='text-muted-foreground'>{t('source')}: {sourceLabel(event)}</p>
          </CardContent>
        </Card>

        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h3 className='text-xl font-semibold'>{t('editions')}</h3>
            <p className='text-sm text-muted-foreground'>{t('intro')}</p>
          </div>
          <Link href={`${eventPath}/editions/new`} className={buttonVariants()}>
            <Plus /> {t('newEdition')}
          </Link>
        </div>

        {editions.length === 0 ? (
          <Card><CardHeader><CardTitle>{t('emptyEditions')}</CardTitle></CardHeader></Card>
        ) : (
          <div className='grid gap-4 md:grid-cols-2'>
            {editions.map((edition) => (
              <Card key={edition.id}>
                <CardHeader className='flex-row items-start justify-between gap-4'>
                  <div>
                    <CardTitle>{edition.label}</CardTitle>
                    <CardDescription>{date(edition.startDate)}{edition.endDate ? ` – ${date(edition.endDate)}` : ''}</CardDescription>
                  </div>
                  <Badge variant='outline'>{t(`statuses.${edition.status}`)}</Badge>
                </CardHeader>
                <CardContent className='flex justify-end'>
                  <Link href={`${eventPath}/editions/${edition.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    {t('courses')} <ChevronRight />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (segments[1] !== 'editions') notFound()
  if (segments.length === 3 && segments[2] === 'new') {
    return <FormPage title={t('newEdition')} backPath={eventPath} backLabel={event.name}>
      <CatalogForm kind='edition' locale={locale} event={event} backPath={eventPath} />
    </FormPage>
  }

  if (!segments[2]) notFound()
  const edition = getRaceEdition(segments[2])
  if (!edition || edition.isDeleted || edition.raceEventId !== event.id) notFound()
  const editionPath = `${eventPath}/editions/${edition.id}`

  if (segments.length === 4 && ['edit', 'archive'].includes(segments[3])) {
    const archive = segments[3] === 'archive'
    return <FormPage title={`${t(archive ? 'archive' : 'edit')}: ${edition.label}`} backPath={editionPath} backLabel={edition.label}>
      <CatalogForm kind='edition' locale={locale} event={event} edition={edition} backPath={editionPath} archive={archive} />
    </FormPage>
  }

  if (segments.length === 3) {
    const courses = listRaceCourses(edition.id)
    const location = [edition.location?.locality, edition.location?.region, edition.location?.countryCode].filter(Boolean).join(' · ')

    return (
      <div className='space-y-6'>
        <DetailHeader backPath={eventPath} backLabel={event.name} title={edition.label}>
          <Badge variant='outline'>{t(`statuses.${edition.status}`)}</Badge>
        </DetailHeader>

        <Card>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle>{edition.label}</CardTitle>
                <CardDescription>{date(edition.startDate)}{edition.endDate ? ` – ${date(edition.endDate)}` : ''}</CardDescription>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Link href={`${editionPath}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Pencil /> {t('edit')}
                </Link>
                <Link href={`${editionPath}/archive`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Archive /> {t('archive')}
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            {edition.organizerName && <p>{edition.organizerName}</p>}
            {location && <p className='flex items-center gap-2 text-muted-foreground'><MapPin className='size-4' /> {location}</p>}
            {edition.notes && <p className='whitespace-pre-wrap'>{edition.notes}</p>}
            {edition.websiteUrl && <p>{t('fields.websiteUrl')}: {edition.websiteUrl}</p>}
            <p className='text-muted-foreground'>{t('source')}: {sourceLabel(edition)}</p>
          </CardContent>
        </Card>

        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h3 className='text-xl font-semibold'>{t('courses')}</h3>
            <p className='text-sm text-muted-foreground'>{event.name} · {edition.label}</p>
          </div>
          <Link href={`${editionPath}/courses/new`} className={buttonVariants()}>
            <Plus /> {t('newCourse')}
          </Link>
        </div>

        {courses.length === 0 ? (
          <Card><CardHeader><CardTitle>{t('emptyCourses')}</CardTitle></CardHeader></Card>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader className='flex-row items-start justify-between gap-4'>
                  <div>
                    <CardTitle>{course.label}</CardTitle>
                    <CardDescription>{metric(course.distanceKm, 'km')} · {metric(course.elevationGainM, 'm+')}</CardDescription>
                  </div>
                  <Badge variant='outline'>{t(`statuses.${course.status}`)}</Badge>
                </CardHeader>
                <CardContent className='flex justify-end'>
                  <Link href={`${editionPath}/courses/${course.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    {t('fields.modalityCode')} <ChevronRight />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (segments[3] !== 'courses') notFound()
  if (segments.length === 5 && segments[4] === 'new') {
    return <FormPage title={t('newCourse')} backPath={editionPath} backLabel={`${event.name} / ${edition.label}`}>
      <CatalogForm kind='course' locale={locale} event={event} edition={edition} backPath={editionPath} />
    </FormPage>
  }

  if (!segments[4]) notFound()
  const course = getRaceCourse(segments[4])
  if (!course || course.isDeleted || course.raceEditionId !== edition.id) notFound()
  const coursePath = `${editionPath}/courses/${course.id}`

  if (segments.length === 6 && ['edit', 'archive'].includes(segments[5])) {
    const archive = segments[5] === 'archive'
    return <FormPage title={`${t(archive ? 'archive' : 'edit')}: ${course.label}`} backPath={coursePath} backLabel={course.label}>
      <CatalogForm
        kind='course'
        locale={locale}
        event={event}
        edition={edition}
        course={course}
        backPath={coursePath}
        archive={archive}
      />
    </FormPage>
  }

  if (segments.length !== 5) notFound()
  const derived = deriveRaceCourseProfile(course)
  const interaction = await loadCourseRegistrationData(
    {
      teamId: 'team_1',
      raceEditionId: edition.id,
      raceCourseId: course.id,
    },
    {
      listActiveAthletes: listActiveCourseRegistrationAthletes,
      listEffectiveRegistrationsInEdition: listEffectiveCourseRegistrationsInEdition,
    },
  )

  return (
    <div className='space-y-6'>
      <DetailHeader backPath={editionPath} backLabel={`${event.name} / ${edition.label}`} title={course.label}>
        <Badge variant='outline'>{t(`statuses.${course.status}`)}</Badge>
      </DetailHeader>

      <div className='flex flex-wrap justify-end gap-2'>
        <Link href={`${coursePath}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Pencil /> {t('edit')}
        </Link>
        <Link href={`${coursePath}/archive`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Archive /> {t('archive')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'><Mountain className='size-5' /> {course.label}</CardTitle>
          <CardDescription>{event.name} · {edition.label}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            <Metric label={t('fields.distanceKm')} value={metric(course.distanceKm, 'km')} />
            <Metric label={t('fields.elevationGainM')} value={metric(course.elevationGainM, 'm+')} />
            <Metric
              label={t('fields.modalityCode')}
              value={course.modality?.code === 'other' ? course.modality.label : t(`modalities.${course.modality?.code ?? 'unknown'}`)}
            />
            <Metric label={t('density')} value={metric(derived.elevationDensityMPerKm, 'm+/km')} />
            <Metric label={t('effort')} value={metric(derived.kilometerEffortKm, 'km')} />
            <Metric label={t('fields.scheduledStartAt')} value={scheduledStart(course.scheduledStartAt)} />
            <Metric label={t('fields.startLocationLabel')} value={course.startLocationLabel ?? t('unknown')} />
          </dl>
        </CardContent>
      </Card>

      <CourseRegistration event={event} edition={edition} course={course} interaction={interaction} locale={locale} />

      <Card>
        <CardHeader>
          <CardTitle>{t('classifications')}</CardTitle>
          <CardDescription>{t('derivedHint')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {course.notes && <p className='whitespace-pre-wrap'>{course.notes}</p>}
          <p className='text-sm text-muted-foreground'>{t('source')}: {sourceLabel(course)}</p>
          {course.classifications.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{t('noClassifications')}</p>
          ) : (
            <div className='grid gap-3 md:grid-cols-2'>
              {course.classifications.map((classification, index) => (
                <div key={index} className='rounded-lg border p-4'>
                  <p className='font-medium'>{classification.authority} · {classification.label ?? classification.code}</p>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    {t('version')}: {classification.versionRef}
                  </p>
                  <div className='mt-3 flex flex-wrap gap-2'>
                    <Badge variant='secondary'>{t(`dimensions.${classification.dimension}`)}</Badge>
                    <Badge variant='outline'>{t(`provenance.${classification.provenance}`)}</Badge>
                  </div>
                  {classification.sourceUrl && <p className='mt-3 break-all text-xs text-muted-foreground'>{t('source')}: {classification.sourceUrl}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DetailHeader({ backPath, backLabel, title, children }: {
  backPath: string
  backLabel: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className='space-y-3'>
      <Link href={backPath} className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='size-4' /> {backLabel}
      </Link>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-3xl font-bold tracking-tight'>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function FormPage({ title, backPath, backLabel, children }: {
  title: string
  backPath: string
  backLabel: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-6'>
      <DetailHeader backPath={backPath} backLabel={backLabel} title={title} />
      {children}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{label}</dt>
      <dd className='mt-1 font-medium'>{value}</dd>
    </div>
  )
}
