'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createCompetitionFromCatalogAction } from '@/app/actions/competition-calendar-actions'
import { RaceCoursePicker } from './RaceCoursePicker'
import type { RaceCourseSearchResult } from '@/lib/race-catalog/catalog-repository'
import { Button } from '@ui/button'

export function CatalogCompetitionForm({ planId, locale }: { planId: string; locale: string }) {
  const t = useTranslations('RaceCatalog')
  const [selected, setSelected] = useState<RaceCourseSearchResult | null>(null)
  const [state, action, pending] = useActionState(createCompetitionFromCatalogAction, {})
  return <details className='rounded-xl border p-5'>
    <summary className='cursor-pointer font-semibold'>{t('addToPlan')}</summary>
    <form action={action} className='mt-4 space-y-4'>
      <input type='hidden' name='planId' value={planId} />
      <input type='hidden' name='locale' value={locale} />
      <RaceCoursePicker selected={selected} onSelect={setSelected} />
      <label className='flex items-center gap-3'>
        {t('priority')}
        <select name='priority' defaultValue='B' className='rounded-lg border bg-background p-2'>
          {['A', 'B', 'C'].map(priority => <option key={priority}>{priority}</option>)}
        </select>
      </label>
      <p className='text-sm text-muted-foreground'>{t('planNotice')}</p>
      {state.error && <p role='alert' className='text-destructive'>{t('errors.' + state.error)}</p>}
      <Button type='submit' disabled={pending || !selected}>{pending ? t('saving') : t('addToPlan')}</Button>
    </form>
  </details>
}
