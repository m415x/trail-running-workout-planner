'use client'

import { useTranslations } from 'next-intl'

/**
 * No account-preference writer or athlete-safe medical disclosure is approved yet.
 * Preserve Settings as a non-fictitious, localized surface while T7 integrates
 * existing locale/theme/logout/recovery contracts.
 */
export function SettingsTabContent() {
  const t = useTranslations('AthleteProfile.tabs')
  return (
    <div className='space-y-3 mt-2'>
      <h2 className='text-sm font-semibold text-foreground'>{t('settings')}</h2>
    </div>
  )
}
