'use client'

import { useState, useTransition } from 'react'

import { materializeTeamMonthlyChargesAction } from '@/app/actions/membership-actions'
import { Button } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'
import { Label } from '@ui/label'

type Locale = 'es' | 'en'

export function TeamMonthlyMaterializationForm({ locale }: { locale: Locale }) {
  const es = locale === 'es'
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setFeedback(null)
    setError(null)
    const [year, month] = String(formData.get('period') ?? '').split('-').map(Number)

    startTransition(async () => {
      const result = await materializeTeamMonthlyChargesAction({ year, month, locale })
      if (!result.success) {
        setError(es ? 'No se pudieron materializar las cuotas.' : 'Could not materialize charges.')
        return
      }

      setFeedback(
        es
          ? `Atletas procesados: ${result.processedAthletes} · Cuotas creadas: ${result.materializedCharges}`
          : `Athletes processed: ${result.processedAthletes} · Charges created: ${result.materializedCharges}`,
      )
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{es ? 'Materializar cuotas' : 'Materialize charges'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className='space-y-4'>
          <p className='text-sm text-muted-foreground'>
            {es
              ? 'Genera las cuotas faltantes del equipo para el mes seleccionado.'
              : 'Creates missing team charges for the selected month.'}
          </p>
          <div className='space-y-2'>
            <Label htmlFor='materializationPeriod'>{es ? 'Mes' : 'Month'}</Label>
            <Input id='materializationPeriod' name='period' type='month' required />
          </div>
          {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
          {feedback && <p role='status' className='text-sm text-muted-foreground'>{feedback}</p>}
          <Button type='submit' disabled={isPending}>
            {isPending
              ? (es ? 'Materializando…' : 'Materializing…')
              : (es ? 'Materializar cuotas' : 'Materialize charges')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
