'use client'

import { useTranslations } from 'next-intl'
import { ThemeToggleButton } from '@/components/ui/custom/buttons'

/**
 * Reuse the existing theme controller without introducing account settings
 * persistence. Other settings are deferred to T7; no medical mock data.
 */
export function SettingsTabContent() {
  const t = useTranslations('AthleteProfile.settings')
  return (
    <div className='mt-2 flex items-center justify-between rounded-2xl border border-border p-4'>
      <span className='text-sm font-medium text-foreground'>{t('theme')}</span>
      <ThemeToggleButton aria-label={t('changeTheme')} />
    </div>
  )
}
