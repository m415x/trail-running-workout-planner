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
import type { AthleteAdministrativeReadInput } from '@/lib/athletes/administrative-read-model'
import { getGroupMemberOptionName } from '@/features/groups/lib/group-member-option-label'

interface EligibleAthlete extends AthleteAdministrativeReadInput {
  groupId: string | null
  group: {
    categoryCode: string
    levelCode: string
  } | null
}

interface GroupMemberAssignmentFormProps {
  locale: string
  groupId: string
  groupCode: string
  athletes: EligibleAthlete[]
  defaultEffectiveDate: string
}

const initialState: AthleteGroupFormState = {}

export function GroupMemberAssignmentForm({
  locale,
  groupId,
  groupCode,
  athletes,
  defaultEffectiveDate,
}: GroupMemberAssignmentFormProps) {
  const t = useTranslations('CoachPlanningAudience.sportingGroups')
  const [state, formAction, pending] = useActionState(assignAthleteToGroup, initialState)
  const groupPath = locale === 'es'
    ? `/dashboard/groups/${groupId}`
    : `/${locale}/dashboard/groups/${groupId}`

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='newGroupId' value={groupId} />
      <input type='hidden' name='returnContext' value={`group:${groupId}`} />
      <input type='hidden' name='locale' value={locale} />

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      <div className='rounded-xl border p-4'>
        <p className='text-sm text-muted-foreground'>{t('destinationGroup')}</p>
        <p className='text-2xl font-semibold'>{groupCode}</p>
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='athleteId' className='text-sm font-medium'>
          {t('athleteToAssign')} <span className='text-destructive'>*</span>
        </label>
        <select
          id='athleteId'
          name='athleteId'
          required
          defaultValue=''
          disabled={athletes.length === 0}
          className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'
        >
          <option value='' disabled>{t('selectAthlete')}</option>
          {athletes.map((athlete) => {
            const fullName = getGroupMemberOptionName(athlete)
            const currentGroup = athlete.group
              ? `${athlete.group.categoryCode}${athlete.group.levelCode}`
              : t('withoutSportingGroup')

            return (
              <option key={athlete.id} value={athlete.id}>
                {fullName} · {t('currentSportingGroup', { group: currentGroup })}
              </option>
            )
          })}
        </select>
        {athletes.length === 0 && (
          <p className='text-sm text-muted-foreground'>{t('noEligibleAthletes')}</p>
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
        <label htmlFor='reason' className='text-sm font-medium'>{t('changeReason')}</label>
        <textarea
          id='reason'
          name='reason'
          rows={4}
          maxLength={500}
          placeholder={t('changeReasonPlaceholder')}
          className='w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
        />
        <p className='text-xs text-muted-foreground'>{t('changeReasonHelp')}</p>
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={groupPath} className={buttonVariants({ variant: 'outline' })}>
          {t('cancelMemberAssignment')}
        </Link>
        <Button type='submit' disabled={pending || athletes.length === 0}>
          {pending ? t('assigningMember') : t('confirmMemberAssignment')}
        </Button>
      </div>
    </form>
  )
}
