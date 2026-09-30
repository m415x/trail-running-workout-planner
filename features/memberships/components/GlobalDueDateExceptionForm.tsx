'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'

import { applyGlobalDueDateExceptionAction } from '@/app/actions/membership-actions'
import { Button } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'
import { Label } from '@ui/label'

type Locale = 'es' | 'en'

export function GlobalDueDateExceptionForm({ locale }: { locale: Locale }) {
  const t = useTranslations('Membership.dueDateException')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [period, setPeriod] = useState('')

  const daysInMonth = useMemo(() => {
    const [year, month] = period.split('-').map(Number)
    if (!year || !month) return 31
    return new Date(year, month, 0).getDate()
  }, [period])

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    const selectedPeriod = String(formData.get('period') ?? '')
    const [year, month] = selectedPeriod.split('-').map(Number)
    const dueDay = Number(formData.get('dueDay'))
    const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`

    startTransition(async () => {
      const result = await applyGlobalDueDateExceptionAction({
        year,
        month,
        dueDate,
        reason: String(formData.get('reason') ?? ''),
        locale,
      })
      if (!result.success) {
        setError(t('error'))
        return
      }
      setSuccess(t('success'))
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='exceptionPeriod'>{t('month')}</Label>
              <Input
                id='exceptionPeriod'
                name='period'
                type='month'
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='exceptionDueDay'>
                {t('dueDay')}
              </Label>
              <select
                id='exceptionDueDay'
                name='dueDay'
                className='h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs'
                required
              >
                <option value=''>{t('selectDay')}</option>
                {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='exceptionReason'>{t('reason')}</Label>
            <Input id='exceptionReason' name='reason' required />
          </div>
          {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
          {success && <p role='status' className='text-sm text-muted-foreground'>{success}</p>}
          <Button type='submit' disabled={isPending}>
            {isPending ? t('applying') : t('apply')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
