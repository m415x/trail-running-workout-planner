'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import {
  assignAthleteToGroup,
  type AthleteGroupFormState,
} from '@/app/actions/athlete-actions'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

import type { AthleteCategoryCode, AthleteLevelCode } from '@/types'

interface AssignableGroup {
  id: string
  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode
  description: string | null
}

interface AthleteGroupFormProps {
  athleteId: string
  athleteName: string
  currentGroupId: string | null
  groups: AssignableGroup[]
  locale: string
  defaultEffectiveDate: string
}

const initialState: AthleteGroupFormState = {}

export function AthleteGroupForm({
  athleteId,
  athleteName,
  currentGroupId,
  groups,
  locale,
  defaultEffectiveDate,
}: AthleteGroupFormProps) {
  const t = useTranslations('AthleteGroup')
  const [state, formAction, pending] = useActionState(assignAthleteToGroup, initialState)
  const detailPath = locale === 'es'
    ? `/dashboard/athletes/${athleteId}`
    : `/${locale}/dashboard/athletes/${athleteId}`
  const availableGroups = groups.filter((group) => group.id !== currentGroupId)

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='athleteId' value={athleteId} />
      <input type='hidden' name='locale' value={locale} />

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      <div className='space-y-1.5'>
        <label htmlFor='newGroupId' className='text-sm font-medium'>
          {t('newGroup')} <span className='text-destructive'>*</span>
        </label>
        <select
          id='newGroupId'
          name='newGroupId'
          required
          defaultValue=''
          disabled={availableGroups.length === 0}
          className='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <option value='' disabled>{t('selectGroup')}</option>
          {availableGroups.map((group) => {
            const code = `${group.categoryCode}${group.levelCode}`

            return (
              <option key={group.id} value={group.id}>
                {group.description ? `${code} — ${group.description}` : code}
              </option>
            )
          })}
        </select>
        {availableGroups.length === 0 && (
          <p className='text-sm text-muted-foreground'>{t('noAvailableGroup')}</p>
        )}
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='effectiveDate' className='text-sm font-medium'>
          {t('effectiveDate')} <span className='text-destructive'>*</span>
        </label>
        <Input
          id='effectiveDate'
          name='effectiveDate'
          type='date'
          defaultValue={defaultEffectiveDate}
          required
        />
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='reason' className='text-sm font-medium'>{t('reason')}</label>
        <textarea
          id='reason'
          name='reason'
          rows={4}
          maxLength={500}
          placeholder={t('reasonPlaceholder', { name: athleteName })}
          className='w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
        />
        <p className='text-xs text-muted-foreground'>{t('reasonHelp')}</p>
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={detailPath} className={buttonVariants({ variant: 'outline' })}>
          {t('cancel')}
        </Link>
        <Button type='submit' disabled={pending || availableGroups.length === 0}>
          {pending ? t('assigning') : currentGroupId ? t('changeGroup') : t('assignGroup')}
        </Button>
      </div>
    </form>
  )
}
