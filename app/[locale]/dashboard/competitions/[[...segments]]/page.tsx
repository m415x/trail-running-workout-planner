import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import {
  listRaceEvents, listRaceEditions, listRaceCourses,
  getRaceEvent, getRaceEdition, getRaceCourse,
} from '@/lib/race-catalog/catalog-repository'
import { deriveRaceCourseProfile } from '@/lib/race-catalog/race-course-derived-profile'
import { CatalogForm } from '@/features/race-catalog/components/CatalogForm'
import { buttonVariants } from '@ui/button'
import { Input } from '@ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import { Badge } from '@ui/badge'

interface Props {
  params: Promise<{ locale: string; segments?: string[] }>
  searchParams: Promise<{ q?: string; archived?: string }>
}

/** One hierarchy router; each level verifies ancestry before exposing a record. */
export default async function CompetitionsPage({ params, searchParams }: Props) {
  const { locale, segments = [] } = await params
  const query = await searchParams
  const t = await getTranslations({ locale, namespace: 'RaceCatalog' })
  const base = '/dashboard/competitions'
  const actionLink = (href: string, label: string) => (
    <Link href={href} className={buttonVariants({ variant: 'outline' })}>{label}</Link>
  )
  const date = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC' })
    .format(new Date(value.slice(0, 10) + 'T00:00:00Z'))
  const metric = (value: number | null | undefined, unit: string) => value == null
    ? t('unknown') : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value) + ' ' + unit
  const source = (record: { source?: { origin: string; provider?: string | null; externalId?: string | null } }) => (
    <p className='text-sm text-muted-foreground'>
      {t('source')}: {record.source?.origin === 'external'
        ? [t('external'), record.source.provider, record.source.externalId].filter(Boolean).join(' · ')
        : t('product')}
    </p>
  )
  const heading = (title: string, parentPath: string, parentName: string) => (
    <header className='space-y-3'>
      <Link href={parentPath} className='text-sm underline'>{parentName}</Link>
      <h1 className='text-3xl font-bold'>{title}</h1>
    </header>
  )

  if (segments.length === 0) {
    const q = typeof query.q === 'string' ? query.q.slice(0, 200) : ''
    const events = listRaceEvents(q, query.archived === '1')
    return <div className='mx-auto max-w-5xl space-y-6'>
      {heading(t('navigation'), '/dashboard', t('dashboard'))}
      <p className='text-muted-foreground'>{t('intro')}</p>
      {actionLink(base + '/new', t('newEvent'))}
      <form className='flex flex-wrap items-end gap-3'>
        <div className='min-w-48 flex-1'>
          <label htmlFor='q'>{t('searchEvents')}</label>
          <Input id='q' name='q' defaultValue={q} maxLength={200} />
        </div>
        <label className='flex items-center gap-2'>
          <input type='checkbox' name='archived' value='1' defaultChecked={query.archived === '1'} />
          {t('includeArchived')}
        </label>
        <button className={buttonVariants({ variant: 'outline' })}>{t('search')}</button>
      </form>
      {events.length === 0 && <p className='rounded-lg border p-6'>{t('emptyEvents')}</p>}
      <div className='grid gap-4 sm:grid-cols-2'>
        {events.map(event => <Card key={event.id}>
          <CardHeader><CardTitle><Link className='underline' href={base + '/' + event.id}>{event.name}</Link></CardTitle></CardHeader>
          <CardContent className='space-y-2'>
            <Badge variant='outline'>{t('statuses.' + event.status)}</Badge>
            <p className='whitespace-pre-wrap'>{event.description}</p>
            {source(event)}
          </CardContent>
        </Card>)}
      </div>
    </div>
  }
  if (segments.length === 1 && segments[0] === 'new') return (
    <div className='mx-auto max-w-3xl space-y-6'>
      {heading(t('newEvent'), base, t('navigation'))}
      <CatalogForm kind='event' locale={locale} backPath={base} />
    </div>
  )

  const event = getRaceEvent(segments[0])
  if (!event || event.isDeleted) notFound()
  const eventPath = base + '/' + event.id
  if (segments.length === 2 && ['edit', 'archive'].includes(segments[1])) return (
    <div className='mx-auto max-w-3xl space-y-6'>
      {heading(t(segments[1] === 'archive' ? 'archive' : 'edit') + ': ' + event.name, eventPath, event.name)}
      <CatalogForm kind='event' locale={locale} event={event} backPath={eventPath} archive={segments[1] === 'archive'} />
    </div>
  )
  if (segments.length === 1) {
    const editions = listRaceEditions(event.id)
    return <div className='mx-auto max-w-5xl space-y-6'>
      {heading(event.name, base, t('navigation'))}
      <Badge variant='outline'>{t('statuses.' + event.status)}</Badge>
      <p className='whitespace-pre-wrap'>{event.description}</p>
      {event.websiteUrl && <p>{t('fields.websiteUrl')}: {event.websiteUrl}</p>}
      {source(event)}
      <div className='flex flex-wrap gap-2'>
        {actionLink(eventPath + '/edit', t('edit'))}
        {event.status !== 'archived' && actionLink(eventPath + '/archive', t('archive'))}
        {actionLink(eventPath + '/editions/new', t('newEdition'))}
      </div>
      <h2 className='text-xl font-semibold'>{t('editions')}</h2>
      {editions.length === 0 && <p>{t('emptyEditions')}</p>}
      <ul className='space-y-3'>{editions.map(edition => <li className='rounded-lg border p-4' key={edition.id}>
        <Link className='font-medium underline' href={eventPath + '/editions/' + edition.id}>{edition.label}</Link>
        <p>{date(edition.startDate)}{edition.endDate ? ' – ' + date(edition.endDate) : ''}</p>
        <Badge variant='outline'>{t('statuses.' + edition.status)}</Badge>
      </li>)}</ul>
    </div>
  }
  if (segments[1] !== 'editions') notFound()
  if (segments.length === 3 && segments[2] === 'new') return (
    <div className='mx-auto max-w-3xl space-y-6'>
      {heading(t('newEdition'), eventPath, event.name)}
      <CatalogForm kind='edition' locale={locale} event={event} backPath={eventPath} />
    </div>
  )
  if (!segments[2]) notFound()
  const edition = getRaceEdition(segments[2])
  if (!edition || edition.isDeleted || edition.raceEventId !== event.id) notFound()
  const editionPath = eventPath + '/editions/' + edition.id
  if (segments.length === 4 && ['edit', 'archive'].includes(segments[3])) return (
    <div className='mx-auto max-w-3xl space-y-6'>
      {heading(t(segments[3] === 'archive' ? 'archive' : 'edit') + ': ' + edition.label, editionPath, edition.label)}
      <CatalogForm kind='edition' locale={locale} event={event} edition={edition} backPath={editionPath} archive={segments[3] === 'archive'} />
    </div>
  )
  if (segments.length === 3) {
    const courses = listRaceCourses(edition.id)
    return <div className='mx-auto max-w-5xl space-y-6'>
      {heading(edition.label, eventPath, event.name)}
      <p>{date(edition.startDate)}{edition.endDate ? ' – ' + date(edition.endDate) : ''}</p>
      <Badge variant='outline'>{t('statuses.' + edition.status)}</Badge>
      <p>{[edition.organizerName, edition.location?.locality, edition.location?.region, edition.location?.countryCode].filter(Boolean).join(' · ')}</p>
      <p className='whitespace-pre-wrap'>{edition.notes}</p>
      {edition.websiteUrl && <p>{t('fields.websiteUrl')}: {edition.websiteUrl}</p>}
      {source(edition)}
      <div className='flex flex-wrap gap-2'>
        {actionLink(editionPath + '/edit', t('edit'))}
        {actionLink(editionPath + '/archive', t('archive'))}
        {actionLink(editionPath + '/courses/new', t('newCourse'))}
      </div>
      <h2 className='text-xl font-semibold'>{t('courses')}</h2>
      {courses.length === 0 && <p>{t('emptyCourses')}</p>}
      <ul className='space-y-3'>{courses.map(course => <li className='rounded-lg border p-4' key={course.id}>
        <Link className='font-medium underline' href={editionPath + '/courses/' + course.id}>{course.label}</Link>
        <p>{metric(course.distanceKm, 'km')} · {metric(course.elevationGainM, 'm+')}</p>
        <Badge variant='outline'>{t('statuses.' + course.status)}</Badge>
      </li>)}</ul>
    </div>
  }
  if (segments[3] !== 'courses') notFound()
  if (segments.length === 5 && segments[4] === 'new') return (
    <div className='mx-auto max-w-3xl space-y-6'>
      {heading(t('newCourse'), editionPath, event.name + ' / ' + edition.label)}
      <CatalogForm kind='course' locale={locale} event={event} edition={edition} backPath={editionPath} />
    </div>
  )
  if (!segments[4]) notFound()
  const course = getRaceCourse(segments[4])
  if (!course || course.isDeleted || course.raceEditionId !== edition.id) notFound()
  const coursePath = editionPath + '/courses/' + course.id
  if (segments.length === 6 && ['edit', 'archive'].includes(segments[5])) return (
    <div className='mx-auto max-w-3xl space-y-6'>
      {heading(t(segments[5] === 'archive' ? 'archive' : 'edit') + ': ' + course.label, coursePath, course.label)}
      <CatalogForm kind='course' locale={locale} event={event} edition={edition} course={course}
        backPath={coursePath} archive={segments[5] === 'archive'} />
    </div>
  )
  if (segments.length !== 5) notFound()
  const derived = deriveRaceCourseProfile(course)
  return <div className='mx-auto max-w-4xl space-y-6'>
    {heading(course.label, editionPath, event.name + ' / ' + edition.label)}
    <Badge variant='outline'>{t('statuses.' + course.status)}</Badge>
    <div className='flex gap-2'>
      {actionLink(coursePath + '/edit', t('edit'))}
      {actionLink(coursePath + '/archive', t('archive'))}
    </div>
    <dl className='grid grid-cols-2 gap-4 rounded-lg border p-5'>
      <dt>{t('fields.distanceKm')}</dt><dd>{metric(course.distanceKm, 'km')}</dd>
      <dt>{t('fields.elevationGainM')}</dt><dd>{metric(course.elevationGainM, 'm+')}</dd>
      <dt>{t('fields.modalityCode')}</dt><dd>{course.modality?.code === 'other'
        ? course.modality.label : t('modalities.' + (course.modality?.code ?? 'unknown'))}</dd>
      <dt>{t('density')}</dt><dd>{metric(derived.elevationDensityMPerKm, 'm+/km')}</dd>
      <dt>{t('effort')}</dt><dd>{metric(derived.kilometerEffortKm, 'km')}</dd>
      <dt>{t('fields.scheduledStartAt')}</dt><dd>{course.scheduledStartAt ?? t('unknown')}</dd>
      <dt>{t('fields.startLocationLabel')}</dt><dd>{course.startLocationLabel ?? t('unknown')}</dd>
    </dl>
    <p className='text-sm text-muted-foreground'>{t('derivedHint')}</p>
    <p className='whitespace-pre-wrap'>{course.notes}</p>
    {source(course)}
    <h2 className='text-xl font-semibold'>{t('classifications')}</h2>
    {course.classifications.length === 0 && <p>{t('noClassifications')}</p>}
    <ul className='space-y-3'>{course.classifications.map((classification, index) => (
      <li key={index} className='space-y-1 rounded-lg border p-4'>
        <p className='font-medium'>{classification.authority} · {classification.label ?? classification.code}</p>
        <p>{t('version')}: {classification.versionRef} · {classification.systemId} · {classification.code}</p>
        <p>{t('dimensions.' + classification.dimension)}</p>
        <p>{t('provenance.' + classification.provenance)}</p>
        {classification.sourceUrl && <p>{t('source')}: {classification.sourceUrl}</p>}
      </li>
    ))}</ul>
  </div>
}
