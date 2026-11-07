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
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'

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

  // The resolved Team is server-owned H3 evidence. React remounts the client shell
  // when that Team changes, discarding stale Home state from the previous Team.
  // This key controls presentation lifecycle only; each Server Action still
  // independently enforces H2/H3/H4A before reading any data.
  const activeTeam = await createActiveTeamNextServerContext().resolve(access.userId)
  const teamKey = activeTeam.status === 'resolved'
    ? `${access.userId}:${activeTeam.teamId}`
    : `${access.userId}:${activeTeam.status}`

  return <DashboardShell key={teamKey} visibleDestinations={visibleDestinations}>{children}</DashboardShell>
}
