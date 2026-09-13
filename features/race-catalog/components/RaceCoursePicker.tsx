'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { searchSelectableRaceCourses } from '@/app/actions/race-catalog-actions'
import type { RaceCourseSearchResult } from '@/lib/race-catalog/catalog-repository'
import { Button } from '@ui/button'
import { Input } from '@ui/input'

interface Props {
  selected: RaceCourseSearchResult | null
  onSelect: (selection: RaceCourseSearchResult | null) => void
}

/** Explicit search and selection; no form submits or snapshot writes on search. */
export function RaceCoursePicker({ selected, onSelect }: Props) {
  const t = useTranslations('RaceCatalog')
  const format = useFormatter()
  const id = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RaceCourseSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()
  const request = useRef(0)
  function search() {
    const sequence = ++request.current
    setFailed(false)
    startTransition(async () => {
      try {
        const next = await searchSelectableRaceCourses(query)
        if (request.current === sequence) { setResults(next); setSearched(true) }
      } catch {
        if (request.current === sequence) setFailed(true)
      }
    })
  }
  return <section className='space-y-3 rounded-lg border p-4'>
    <label htmlFor={id} className='font-medium'>{t('selectCourse')}</label>
    <div className='flex gap-2'>
      <Input id={id} value={query} maxLength={200} onChange={event => setQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); search() } }} />
      <Button type='button' variant='outline' disabled={pending} onClick={search}>
        {pending ? t('searching') : t('search')}
      </Button>
    </div>
    {failed && <p role='alert'>{t('errors.saveFailed')}</p>}
    {searched && !pending && results.length === 0 && <p role='status'>{t('emptySelection')}</p>}
    {results.length > 0 && <div className='max-h-64 overflow-y-auto'>
      <ul className='space-y-2'>{results.map(result => <li key={result.course.id}>
        <Button type='button' variant={selected?.course.id === result.course.id ? 'secondary' : 'outline'}
          className='h-auto w-full justify-start whitespace-normal text-left'
          onClick={() => onSelect(result)}>
          {result.event.name} / {result.edition.label} / {result.course.label}
        </Button>
      </li>)}</ul>
      <p className='text-xs text-muted-foreground'>{t('searchLimit')}</p>
    </div>}
    {selected && <div className='space-y-2 rounded-lg bg-muted p-3' role='status'>
      <p className='font-medium'>{selected.event.name} / {selected.edition.label} / {selected.course.label}</p>
      <p>{format.dateTime(new Date((selected.course.scheduledStartAt?.slice(0, 10) ?? selected.edition.startDate) + 'T00:00:00Z'), { timeZone: 'UTC' })} · {selected.course.distanceKm === null ? t('unknown') : format.number(selected.course.distanceKm)} km · {selected.course.elevationGainM == null ? t('unknown') : format.number(selected.course.elevationGainM) + ' m+'}</p>
      <Button type='button' variant='outline' onClick={() => onSelect(null)}>{t('clearSelection')}</Button>
    </div>}
    <p className='text-sm text-muted-foreground'>{t('snapshotNotice')}</p>
    <Link href='/dashboard/competitions' target='_blank' className='text-sm underline'>{t('openCatalog')}</Link>
    <input type='hidden' name='raceCourseId' value={selected?.course.id ?? ''} />
    <input type='hidden' name='catalogRevision' value={selected
      ? JSON.stringify([selected.event.updatedAt, selected.edition.updatedAt, selected.course.updatedAt]) : ''} />
  </section>
}
