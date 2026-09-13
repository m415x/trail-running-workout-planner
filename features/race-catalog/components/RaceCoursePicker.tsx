'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { ExternalLink, Search, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { searchSelectableRaceCourses } from '@/app/actions/race-catalog-actions'
import { Link } from '@/i18n/routing'
import type { RaceCourseSearchResult } from '@/lib/race-catalog/catalog-repository'
import { Badge } from '@ui/badge'
import { Button, buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'

interface Props {
  selected: RaceCourseSearchResult | null
  onSelect: (selection: RaceCourseSearchResult | null) => void
}

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
        if (request.current === sequence) {
          setResults(next)
          setSearched(true)
        }
      } catch {
        if (request.current === sequence) setFailed(true)
      }
    })
  }

  const selectedDate = selected
    ? new Date(`${selected.course.scheduledStartAt?.slice(0, 10) ?? selected.edition.startDate}T00:00:00Z`)
    : null

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='text-base'>{t('selectCourse')}</CardTitle>
            <CardDescription>{t('snapshotNotice')}</CardDescription>
          </div>
          <Link href='/dashboard/competitions' target='_blank' className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            {t('openCatalog')} <ExternalLink />
          </Link>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-1.5'>
          <label htmlFor={id} className='text-sm font-medium'>{t('searchEvents')}</label>
          <div className='flex gap-2'>
            <Input
              id={id}
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  search()
                }
              }}
            />
            <Button type='button' variant='outline' disabled={pending} onClick={search}>
              <Search /> {pending ? t('searching') : t('search')}
            </Button>
          </div>
        </div>

        {failed && (
          <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
            {t('errors.saveFailed')}
          </div>
        )}
        {searched && !pending && results.length === 0 && (
          <p role='status' className='text-sm text-muted-foreground'>{t('emptySelection')}</p>
        )}

        {results.length > 0 && (
          <div className='space-y-2'>
            <div className='max-h-64 space-y-2 overflow-y-auto pr-1'>
              {results.map((result) => {
                const active = selected?.course.id === result.course.id
                return (
                  <button
                    key={result.course.id}
                    type='button'
                    onClick={() => onSelect(result)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${active ? 'border-primary bg-muted' : 'border-border'}`}
                  >
                    <div className='flex flex-wrap items-start justify-between gap-2'>
                      <div>
                        <p className='font-medium'>{result.event.name}</p>
                        <p className='text-sm text-muted-foreground'>{result.edition.label} · {result.course.label}</p>
                      </div>
                      {active && <Badge>{t('selectCourse')}</Badge>}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className='text-xs text-muted-foreground'>{t('searchLimit')}</p>
          </div>
        )}

        {selected && selectedDate && (
          <div className='rounded-xl border bg-muted/30 p-4' role='status'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <p className='font-semibold'>{selected.event.name}</p>
                <p className='text-sm text-muted-foreground'>{selected.edition.label} · {selected.course.label}</p>
              </div>
              <Button type='button' variant='ghost' size='sm' onClick={() => onSelect(null)}>
                <X /> {t('clearSelection')}
              </Button>
            </div>
            <p className='mt-3 text-sm'>
              {format.dateTime(selectedDate, { timeZone: 'UTC' })} · {' '}
              {selected.course.distanceKm === null ? t('unknown') : `${format.number(selected.course.distanceKm)} km`} · {' '}
              {selected.course.elevationGainM == null ? t('unknown') : `${format.number(selected.course.elevationGainM)} m+`}
            </p>
          </div>
        )}

        <input type='hidden' name='raceCourseId' value={selected?.course.id ?? ''} />
        <input
          type='hidden'
          name='catalogRevision'
          value={selected ? JSON.stringify([selected.event.updatedAt, selected.edition.updatedAt, selected.course.updatedAt]) : ''}
        />
      </CardContent>
    </Card>
  )
}
