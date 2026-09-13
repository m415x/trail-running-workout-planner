'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'

import { saveRaceCatalog } from '@/app/actions/race-catalog-actions'
import { Link } from '@/i18n/routing'
import type { CatalogFormState } from '@/lib/race-catalog/catalog-form'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'
import { Button, buttonVariants } from '@ui/button'
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
  const statusOptions = kind === 'event'
    ? ['active', 'archived']
    : kind === 'edition'
      ? ['draft', 'published', 'completed', 'cancelled']
      : ['draft', 'published', 'cancelled']

  const field = (
    name: string,
    defaultValue?: string | number | null,
    type = 'text',
    required = false,
  ) => (
    <div className='space-y-1.5' key={name}>
      <label className='text-sm font-medium' htmlFor={name}>
        {t(`fields.${name}`)}{required && <span className='text-destructive'> *</span>}
      </label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        type={type}
        required={required}
        maxLength={type === 'text' ? 2000 : undefined}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        aria-invalid={state.fields?.includes(name)}
      />
    </div>
  )

  return (
    <form action={action} className='space-y-6'>
      <input type='hidden' name='kind' value={kind} />
      <input type='hidden' name='operation' value={archive ? 'archive' : 'save'} />
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='id' value={record?.id ?? ''} />
      <input type='hidden' name='revision' value={record?.updatedAt ?? ''} />
      <input type='hidden' name='eventId' value={event?.id ?? ''} />
      <input type='hidden' name='editionId' value={edition?.id ?? ''} />

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {t(`errors.${state.error}`)}
        </div>
      )}

      {archive ? (
        <div className='rounded-xl border border-destructive/30 bg-destructive/5 p-4'>
          <p className='font-medium text-destructive'>{t('archive')}</p>
          <p className='mt-1 text-sm text-muted-foreground'>{t('archiveNotice')}</p>
        </div>
      ) : (
        <>
          <div className='grid gap-4 sm:grid-cols-2'>
            {kind === 'event' ? (
              <>
                {field('name', event?.name, 'text', true)}
                {field('websiteUrl', event?.websiteUrl, 'url')}
                <div className='sm:col-span-2'>{field('description', event?.description)}</div>
              </>
            ) : kind === 'edition' ? (
              <>
                {field('label', edition?.label, 'text', true)}
                {field('startDate', edition?.startDate, 'date', true)}
                {field('endDate', edition?.endDate, 'date')}
                {field('organizerName', edition?.organizerName)}
                {field('locality', edition?.location?.locality)}
                {field('region', edition?.location?.region)}
                {field('countryCode', edition?.location?.countryCode)}
                {field('websiteUrl', edition?.websiteUrl, 'url')}
                <div className='sm:col-span-2'>{field('notes', edition?.notes)}</div>
              </>
            ) : (
              <>
                {field('label', course?.label, 'text', true)}
                {field('distanceKm', course?.distanceKm, 'number')}
                {field('elevationGainM', course?.elevationGainM, 'number')}
                <SelectField
                  label={t('fields.modalityCode')}
                  name='modalityCode'
                  defaultValue={course?.modality?.code ?? ''}
                >
                  {['', 'road', 'trail', 'skyrunning', 'vertical_kilometer', 'other'].map((code) => (
                    <option key={code} value={code}>{t(`modalities.${code || 'unknown'}`)}</option>
                  ))}
                </SelectField>
                {field('modalityLabel', course?.modality?.code === 'other' ? course.modality.label : '')}
                {field('scheduledStartAt', course?.scheduledStartAt?.slice(0, 16), 'datetime-local')}
                {field('startLocationLabel', course?.startLocationLabel)}
                <div className='sm:col-span-2'>{field('notes', course?.notes)}</div>
              </>
            )}

            <SelectField
              label={t('fields.status')}
              name='status'
              defaultValue={record?.status ?? statusOptions[0]}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>{t(`statuses.${status}`)}</option>
              ))}
            </SelectField>
          </div>

          {kind === 'course' && (
            <div className='rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground'>{t('unknownHint')}</div>
          )}
          <div className='rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground'>{t('snapshotNotice')}</div>
        </>
      )}

      <div className='flex justify-end gap-2'>
        <Link href={backPath} className={buttonVariants({ variant: 'outline' })}>{t('cancel')}</Link>
        <Button type='submit' disabled={pending} variant={archive ? 'destructive' : 'default'}>
          {pending ? t('saving') : archive ? t('confirmArchive') : t('save')}
        </Button>
      </div>
    </form>
  )
}

function SelectField({ label, name, defaultValue, children }: {
  label: string
  name: string
  defaultValue?: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}</label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
      >
        {children}
      </select>
    </div>
  )
}
