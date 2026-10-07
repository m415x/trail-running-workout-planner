import { redirect } from 'next/navigation'

import { DashboardShell } from './DashboardShell'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptSession } from '@/lib/auth/require-authenticated-session'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'

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
  const lookup = createExternalIdentityLookup()
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

  return <DashboardShell>{children}</DashboardShell>
}
