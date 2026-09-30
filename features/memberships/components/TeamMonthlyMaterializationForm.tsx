'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'

import { materializeTeamMonthlyChargesAction } from '@/app/actions/membership-actions'
import { Button } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'
import { Label } from '@ui/label'

type Locale = 'es' | 'en'

export function TeamMonthlyMaterializationForm({ locale }: { locale: Locale }) {
  const t = useTranslations('Membership.materialization')
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
        setError(t('error'))
        return
      }

      setFeedback(t('feedback', {
        processed: result.processedAthletes,
        created: result.materializedCharges,
      }))
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className='space-y-4'>
          <p className='text-sm text-muted-foreground'>
            {t('description')}
          </p>
          <div className='space-y-2'>
            <Label htmlFor='materializationPeriod'>{t('month')}</Label>
            <Input id='materializationPeriod' name='period' type='month' required />
          </div>
          {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
          {feedback && <p role='status' className='text-sm text-muted-foreground'>{feedback}</p>}
          <Button type='submit' disabled={isPending}>
            {isPending ? t('pending') : t('action')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
