import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { AudienceAccessUnavailable } from '@/components/auth/AudienceAccessUnavailable'
import { createNextServerIdentityEvidence } from '@/lib/auth/identity-backend-next-server'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { resolveExistingSessionLogin } from '@/lib/auth/existing-session-login'
import { resolveNextServerAudience } from '@/lib/auth/next-server-audience'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'

import { LoginForm } from './LoginForm'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ returnTo?: string | string[]; recovery?: string | string[] }>
}) {
  const { locale: rawLocale } = await params
  const { returnTo: rawReturnTo, recovery } = await searchParams
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const returnTo = typeof rawReturnTo === 'string' ? rawReturnTo : ''
  const supabase = await createSupabaseServerClient()
  const session = await readEptSessionAccessState(supabase.auth, createNextServerIdentityEvidence().lookup)
  const audience = session.status === 'authenticated'
    ? await resolveNextServerAudience(session.userId)
    : { status: 'deny' as const }
  const decision = resolveExistingSessionLogin({ session, audience, locale, returnTo })
  if (decision.status === 'redirect') redirect(decision.location)
  if (decision.status === 'access_unavailable') return <AudienceAccessUnavailable locale={locale} />

  const t = await getTranslations({ locale, namespace: 'Login' })

  return (
    <main className='flex min-h-dvh items-center justify-center p-6'>
      <section className='flex w-full max-w-sm flex-col gap-6'>
        <header className='space-y-2'>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-sm text-muted-foreground'>{t('description')}</p>
        </header>

        {recovery === 'updated' ? (
          <p role='status' className='text-sm text-muted-foreground'>
            {t('recoveryUpdated')}
          </p>
        ) : null}

        <LoginForm locale={locale} returnTo={returnTo} />
      </section>
    </main>
  )
}
