'use client'

import { useActionState, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  type SessionGenerationPreferencesFormState,
  updateSessionGenerationPreferences,
} from '@/app/actions/session-generation-preferences-actions'
import type {
  TrainingWeekday,
  WeeklySessionRole,
  WeeklyTrainingPattern,
} from '@/types/training/session-generation.types'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Checkbox } from '@ui/checkbox'
import { Input } from '@ui/input'
import { Label } from '@ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select'

interface SessionGenerationPreferencesFormProps {
  planId: string
  locale: string
  frequency: { mode: 'auto' } | { mode: 'fixed'; sessionsPerWeek: number }
  pattern: WeeklyTrainingPattern
}

type DayConfig = {
  weekday: TrainingWeekday
  enabled: boolean
  role: WeeklySessionRole
}

const initialActionState: SessionGenerationPreferencesFormState = {}

const weekdayOptions: TrainingWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const roleOptions: WeeklySessionRole[] = [
  'base',
  'mountain',
  'long',
  'quality',
  'recovery',
  'competition',
]

export function SessionGenerationPreferencesForm({
  planId,
  locale,
  frequency,
  pattern,
}: SessionGenerationPreferencesFormProps) {
  const t = useTranslations('CoachPlanning')
  const [fixedSessions, setFixedSessions] = useState(
    frequency.mode === 'fixed' ? String(frequency.sessionsPerWeek) : '',
  )
  const [days, setDays] = useState<DayConfig[]>(() => {
    const slotByDay = new Map(pattern.slots.map((slot) => [slot.weekday, slot]))

    return weekdayOptions.map((weekday) => ({
      weekday,
      enabled: slotByDay.has(weekday),
      role: slotByDay.get(weekday)?.role ?? defaultRoleForDay(weekday),
    }))
  })
  const [actionState, formAction, isPending] = useActionState(
    updateSessionGenerationPreferences,
    initialActionState,
  )

  const enabledDays = useMemo(() => days.filter((day) => day.enabled), [days])
  const patternPayload = useMemo(
    () => JSON.stringify(enabledDays.map(({ weekday, role }) => ({ weekday, role }))),
    [enabledDays],
  )
  const hasValidDayCount = enabledDays.length >= 3

  function updateDay(weekday: TrainingWeekday, patch: Partial<DayConfig>) {
    setDays((current) => current.map((day) => (
      day.weekday === weekday ? { ...day, ...patch } : day
    )))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sessionGeneration.title')}</CardTitle>
        <CardDescription>
          {t('sessionGeneration.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className='space-y-6'>
          <input type='hidden' name='planId' value={planId} />
          <input type='hidden' name='locale' value={locale} />
          <input type='hidden' name='weeklyPattern' value={patternPayload} />

          <div className='space-y-2'>
            <Label htmlFor='fixedSessionsPerWeek'>{t('sessionGeneration.frequencyLabel')}</Label>
            <div className='max-w-xs'>
              <Input
                id='fixedSessionsPerWeek'
                name='fixedSessionsPerWeek'
                type='number'
                min='3'
                max='5'
                step='1'
                value={fixedSessions}
                placeholder={t('sessionGeneration.automatic')}
                onChange={(event) => setFixedSessions(event.target.value)}
              />
            </div>
            <p className='text-sm text-muted-foreground'>
              {t('sessionGeneration.frequencyHelp')}
            </p>
          </div>

          <div className='space-y-3'>
            <div>
              <p className='font-medium'>{t('sessionGeneration.patternTitle')}</p>
              <p className='text-sm text-muted-foreground'>
                {t('sessionGeneration.patternHelp')}
              </p>
            </div>

            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {days.map((day) => {
                const label = t(`weekdays.${day.weekday}`)

                return (
                  <div key={day.weekday} className='rounded-lg border p-3'>
                    <div className='flex items-center gap-2'>
                      <Checkbox
                        id={`weekday-${day.weekday}`}
                        checked={day.enabled}
                        onCheckedChange={(checked) => updateDay(day.weekday, { enabled: checked === true })}
                      />
                      <Label htmlFor={`weekday-${day.weekday}`} className='font-medium'>
                        {label}
                      </Label>
                    </div>

                    <div className='mt-3'>
                      <Select
                        value={day.role}
                        disabled={!day.enabled}
                        onValueChange={(value) => updateDay(day.weekday, { role: value as WeeklySessionRole })}
                      >
                        <SelectTrigger aria-label={t('sessionGeneration.roleAriaLabel', { day: label })}>
                          <SelectValue>{t(`roles.${day.role}`)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {t(`roles.${role}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>

            {!hasValidDayCount && (
              <p className='text-sm text-destructive' role='alert'>
                {t('sessionGeneration.minDays')}
              </p>
            )}
          </div>

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              {actionState.error && (
                <p className='text-sm text-destructive' role='alert'>{actionState.error}</p>
              )}
              {actionState.success && (
                <p className='text-sm text-muted-foreground' role='status'>{actionState.success}</p>
              )}
            </div>
            <Button type='submit' disabled={!hasValidDayCount || isPending}>
              {isPending ? t('saving') : t('saveWeeklyConfiguration')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function defaultRoleForDay(weekday: TrainingWeekday): WeeklySessionRole {
  switch (weekday) {
    case 'tuesday':
      return 'mountain'
    case 'wednesday':
    case 'saturday':
      return 'long'
    case 'thursday':
      return 'quality'
    case 'sunday':
      return 'recovery'
    default:
      return 'base'
  }
}
