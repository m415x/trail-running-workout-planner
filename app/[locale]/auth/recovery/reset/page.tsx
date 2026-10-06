import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { readSupabaseServerSessionState } from '@/lib/auth/supabase-server-session-state'
import { RecoveryResetForm } from './RecoveryResetForm'

export default async function RecoveryResetPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'es'

  const supabase = await createSupabaseServerClient()
  const session = await readSupabaseServerSessionState(supabase.auth)

  if (session.status !== 'verified') {
    redirect(
      locale === 'en'
        ? '/en/auth/recovery?error=recovery_invalid'
        : '/es/auth/recovery?error=recovery_invalid',
    )
  }

  const t = await getTranslations({ locale, namespace: 'Recovery' })

  return (
    <main className='flex min-h-dvh items-center justify-center p-6'>
      <section className='flex w-full max-w-sm flex-col gap-6'>
        <header className='space-y-2'>
          <h1 className='text-2xl font-semibold'>{t('resetTitle')}</h1>
          <p className='text-sm text-muted-foreground'>
            {t('resetDescription')}
          </p>
        </header>

        <RecoveryResetForm locale={locale} />
      </section>
    </main>
  )
}
