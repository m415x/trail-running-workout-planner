'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ThemeToggleButton } from '@/components/ui/custom/buttons'
import { logoutAction } from '@/app/actions/auth-actions'
import { completeLogoutNavigation } from '@/lib/auth/logout-navigation'
import { Button } from '@ui/button'
import { useAthleteTypography } from '@/components/layout/MobileShell'
import { ATHLETE_TYPOGRAPHY_PRESETS } from '@/lib/athlete-typography/preference'

/** Account operations reuse existing Supabase recovery and H2 sign-out boundaries. */
export function SettingsTabContent() {
  const t = useTranslations('AthleteProfile.settings')
  const locale = useLocale() === 'en' ? 'en' : 'es'
  const router = useRouter()
  const { preference, setPreference } = useAthleteTypography()
  const [logoutFailed, setLogoutFailed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutFailed(false)
    const status = await completeLogoutNavigation({
      locale,
      signOut: () => logoutAction(locale),
      replace: (path) => router.replace(path),
      refresh: () => router.refresh(),
    })
    if (status !== 'signed_out') {
      setLogoutFailed(true)
      setLoggingOut(false)
    }
  }

  return (
    <div className='mt-2 space-y-3'>
      <div className='flex items-center justify-between rounded-2xl border border-border p-4'>
        <span className='text-sm font-medium text-foreground'>{t('theme')}</span>
        <ThemeToggleButton aria-label={t('changeTheme')} />
      </div>
      <section className='rounded-2xl border border-border p-4' aria-label={t('accessibility.title')}>
        <h2 className='mb-3 text-base font-semibold text-foreground'>{t('accessibility.title')}</h2>
        <fieldset>
          <legend className='mb-2 text-sm font-medium text-foreground'>{t('accessibility.fontSize')}</legend>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {ATHLETE_TYPOGRAPHY_PRESETS.map((preset) => (
              <label
                key={preset}
                className='flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm text-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background'
              >
                <input
                  type='radio'
                  name='athlete-typography-preference'
                  value={preset}
                  checked={preference === preset}
                  onChange={() => setPreference(preset)}
                  className='size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2'
                />
                <span>{t(`accessibility.${preset === 'extra-large' ? 'extraLarge' : preset}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <Link href={`/${locale}/auth/recovery`} className='flex min-h-11 items-center rounded-2xl border border-border p-4 text-sm font-medium underline-offset-4 hover:underline'>
        {t('passwordRecovery')}
      </Link>
      <Button type='button' variant='outline' className='min-h-11 w-full rounded-2xl' disabled={loggingOut} onClick={handleLogout}>
        {t('signOut')}
      </Button>
      {logoutFailed && <p role='alert' className='text-sm text-destructive'>{t('signOutError')}</p>}
    </div>
  )
}
