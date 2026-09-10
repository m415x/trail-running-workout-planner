'use client'

import { useTranslations } from 'next-intl'

/** Reuses the shared glossary definition for both coach and athlete-facing help. */
export function PlanningIntentHelp() {
  const t = useTranslations('DomainGlossary.planningIntent')
  return (
    <details className='text-sm text-muted-foreground'>
      <summary className='cursor-pointer'>{t('title')}</summary>
      <p>{t('summary')}</p>
      <ul className='list-inside list-disc'>
        <li>{t('development')}</li>
        <li>{t('base')}</li>
        <li>{t('maintenance')}</li>
      </ul>
    </details>
  )
}
