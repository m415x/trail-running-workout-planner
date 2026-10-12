import { redirect } from 'next/navigation'

import { MobileShell } from '@/components/layout/MobileShell'
import { AudienceAccessUnavailable } from '@/components/auth/AudienceAccessUnavailable'
import { resolveAthleteShellAudience } from '@/lib/auth/athlete-shell-audience'
import { resolveNextServerAudience } from '@/lib/auth/next-server-audience'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptSession } from '@/lib/auth/require-authenticated-session'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'

export default async function MobileLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()

  const access = await requireAuthenticatedEptSession(
    {
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    },
    {
      locale,
      returnTo: `/${locale}`,
    },
  )

  if (access.status === 'unlinked') {
    redirect(`/${locale}/auth/unlinked`)
  }

  if (access.status === 'redirect') {
    redirect(access.location)
  }

  const audience = await resolveNextServerAudience(access.userId)
  const decision = resolveAthleteShellAudience(audience, locale)
  if (decision.status === 'redirect') redirect(decision.location)
  if (decision.status === 'deny') return <AudienceAccessUnavailable locale={locale} />

  return <MobileShell>{children}</MobileShell>
}
