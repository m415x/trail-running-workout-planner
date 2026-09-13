'use client'

import { useActionState, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { createCompetitionFromCatalogAction } from '@/app/actions/competition-calendar-actions'
import type { RaceCourseSearchResult } from '@/lib/race-catalog/catalog-repository'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

import { RaceCoursePicker } from './RaceCoursePicker'

export function CatalogCompetitionForm({ planId, locale }: { planId: string; locale: string }) {
  const t = useTranslations('RaceCatalog')
  const [selected, setSelected] = useState<RaceCourseSearchResult | null>(null)
  const [state, action, pending] = useActionState(createCompetitionFromCatalogAction, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('addToPlan')}</CardTitle>
        <CardDescription>{t('planNotice')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className='space-y-5'>
          <input type='hidden' name='planId' value={planId} />
          <input type='hidden' name='locale' value={locale} />

          <RaceCoursePicker selected={selected} onSelect={setSelected} />

          <div className='max-w-xs space-y-1.5'>
            <label htmlFor='catalog-priority' className='text-sm font-medium'>{t('priority')}</label>
            <select
              id='catalog-priority'
              name='priority'
              defaultValue='B'
              className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
            >
              {['A', 'B', 'C'].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </div>

          {state.error && (
            <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
              {t(`errors.${state.error}`)}
            </div>
          )}

          <div className='flex justify-end'>
            <Button type='submit' disabled={pending || !selected}>
              <Plus /> {pending ? t('saving') : t('addToPlan')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
