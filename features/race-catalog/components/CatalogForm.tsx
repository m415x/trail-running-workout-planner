'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { saveRaceCatalog } from '@/app/actions/race-catalog-actions'
import type { CatalogFormState } from '@/lib/race-catalog/catalog-form'
import type { RaceEvent, RaceEdition, RaceCourse } from '@/types/training/race-catalog.types'
import { Button } from '@ui/button'
import { Input } from '@ui/input'

interface Props {
  kind: 'event' | 'edition' | 'course'
  locale: string
  event?: RaceEvent
  edition?: RaceEdition
  course?: RaceCourse
  backPath: string
  archive?: boolean
}

const initialState: CatalogFormState = {}

export function CatalogForm({ kind, locale, event, edition, course, backPath, archive = false }: Props) {
  const t = useTranslations('RaceCatalog')
  const [state, action, pending] = useActionState(saveRaceCatalog, initialState)
  const record = kind === 'event' ? event : kind === 'edition' ? edition : course
  const field = (name: string, defaultValue?: string | number | null, type = 'text', required = false) => (
    <div className='space-y-1.5' key={name}>
      <label className='text-sm font-medium' htmlFor={name}>{t('fields.' + name)}</label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} type={type}
        required={required} maxLength={type === 'text' ? 2000 : undefined}
        min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined}
        aria-invalid={state.fields?.includes(name)} />
    </div>
  )
  const statusOptions = kind === 'event' ? ['active', 'archived']
    : kind === 'edition' ? ['draft', 'published', 'completed', 'cancelled']
    : ['draft', 'published', 'cancelled']
  return (
    <form action={action} className='space-y-5'>
      <input type='hidden' name='kind' value={kind} />
      <input type='hidden' name='operation' value={archive ? 'archive' : 'save'} />
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='id' value={record?.id ?? ''} />
      <input type='hidden' name='revision' value={record?.updatedAt ?? ''} />
      <input type='hidden' name='eventId' value={event?.id ?? ''} />
      <input type='hidden' name='editionId' value={edition?.id ?? ''} />
      {state.error && <p role='alert' className='text-destructive'>{t('errors.' + state.error)}</p>}
      {archive ? <p>{t('archiveNotice')}</p> : <>
        <div className='grid gap-4 sm:grid-cols-2'>
          {kind === 'event' ? <>
            {field('name', event?.name, 'text', true)}
            {field('websiteUrl', event?.websiteUrl, 'url')}
            {field('description', event?.description)}
          </> : kind === 'edition' ? <>
            {field('label', edition?.label, 'text', true)}
            {field('startDate', edition?.startDate, 'date', true)}
            {field('endDate', edition?.endDate, 'date')}
            {field('organizerName', edition?.organizerName)}
            {field('locality', edition?.location?.locality)}
            {field('region', edition?.location?.region)}
            {field('countryCode', edition?.location?.countryCode)}
            {field('websiteUrl', edition?.websiteUrl, 'url')}
            {field('notes', edition?.notes)}
          </> : <>
            {field('label', course?.label, 'text', true)}
            {field('distanceKm', course?.distanceKm, 'number')}
            {field('elevationGainM', course?.elevationGainM, 'number')}
            <div className='space-y-1.5'>
              <label htmlFor='modalityCode'>{t('fields.modalityCode')}</label>
              <select id='modalityCode' name='modalityCode' defaultValue={course?.modality?.code ?? ''}
                className='h-9 w-full rounded-lg border bg-background px-3'>
                {['', 'road', 'trail', 'skyrunning', 'vertical_kilometer', 'other'].map(code => (
                  <option key={code} value={code}>{t('modalities.' + (code || 'unknown'))}</option>
                ))}
              </select>
            </div>
            {field('modalityLabel', course?.modality?.code === 'other' ? course.modality.label : '')}
            {field('scheduledStartAt', course?.scheduledStartAt?.slice(0, 16), 'datetime-local')}
            {field('startLocationLabel', course?.startLocationLabel)}
            {field('notes', course?.notes)}
          </>}
          <div className='space-y-1.5'>
            <label htmlFor='status'>{t('fields.status')}</label>
            <select id='status' name='status' defaultValue={record?.status ?? statusOptions[0]}
              className='h-9 w-full rounded-lg border bg-background px-3'>
              {statusOptions.map(status => <option key={status} value={status}>{t('statuses.' + status)}</option>)}
            </select>
          </div>
        </div>
        {kind === 'course' && <p className='text-sm text-muted-foreground'>{t('unknownHint')}</p>}
        <p className='text-sm text-muted-foreground'>{t('snapshotNotice')}</p>
      </>}
      <div className='flex items-center gap-4'>
        <Button type='submit' disabled={pending} variant={archive ? 'destructive' : 'default'}>
          {pending ? t('saving') : archive ? t('confirmArchive') : t('save')}
        </Button>
        <Link href={backPath} className='underline'>{t('cancel')}</Link>
      </div>
    </form>
  )
}
