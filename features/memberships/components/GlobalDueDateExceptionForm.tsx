'use client'

import { useState, useTransition } from 'react'

import { applyGlobalDueDateExceptionAction } from '@/app/actions/membership-actions'
import { Button } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'
import { Label } from '@ui/label'

type Locale = 'es' | 'en'

export function GlobalDueDateExceptionForm({ locale }: { locale: Locale }) {
  const es = locale === 'es'
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    const period = String(formData.get('period') ?? '')
    const [year, month] = period.split('-').map(Number)

    startTransition(async () => {
      const result = await applyGlobalDueDateExceptionAction({
        year,
        month,
        dueDate: String(formData.get('dueDate') ?? ''),
        reason: String(formData.get('reason') ?? ''),
        locale,
      })
      if (!result.success) {
        setError(es ? 'No se pudo aplicar la excepción.' : 'Could not apply the exception.')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {es ? 'Excepción mensual de vencimiento' : 'Monthly due-date exception'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='exceptionPeriod'>{es ? 'Mes' : 'Month'}</Label>
              <Input id='exceptionPeriod' name='period' type='month' required />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='exceptionDueDate'>
                {es ? 'Nuevo vencimiento' : 'New due date'}
              </Label>
              <Input id='exceptionDueDate' name='dueDate' type='date' required />
            </div>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='exceptionReason'>{es ? 'Motivo' : 'Reason'}</Label>
            <Input id='exceptionReason' name='reason' required />
          </div>
          {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
          <Button type='submit' disabled={isPending}>
            {isPending
              ? (es ? 'Aplicando…' : 'Applying…')
              : (es ? 'Aplicar excepción' : 'Apply exception')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
