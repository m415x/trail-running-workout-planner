import { redirect } from 'next/navigation'

import { DashboardShell } from './DashboardShell'
import { AudienceAccessUnavailable } from '@/components/auth/AudienceAccessUnavailable'
import { resolveCoachShellAudience } from '@/lib/auth/coach-shell-audience'
import { resolveNextServerAudience } from '@/lib/auth/next-server-audience'
import { createNextServerIdentityEvidence } from '@/lib/auth/identity-backend-next-server'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptSession } from '@/lib/auth/require-authenticated-session'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createCoachNavigationNextServerProjection } from '@/lib/authorization/h4a-next-server-authorization'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const supabase = await createSupabaseServerClient()
  const lookup = createNextServerIdentityEvidence().lookup
  const access = await requireAuthenticatedEptSession(
    {
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    },
    {
      locale,
      returnTo: `/${locale}/dashboard`,
    },
  )

  if (access.status === 'unlinked') {
    redirect(`/${locale}/auth/unlinked`)
  }

  if (access.status === 'redirect') {
    redirect(access.location)
  }

  const audience = await resolveNextServerAudience(access.userId)
  const decision = resolveCoachShellAudience(audience, locale)
  if (decision.status === 'redirect') redirect(decision.location)
  if (decision.status === 'deny') return <AudienceAccessUnavailable locale={locale} />

  const projectNavigation = createCoachNavigationNextServerProjection()
  const visibleDestinations = await projectNavigation({ status: 'authenticated', userId: access.userId })

  return <DashboardShell visibleDestinations={visibleDestinations}>{children}</DashboardShell>
}
