'use server'

import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'

export type SelectActiveTeamActionResult =
  | { status: 'accepted'; teamId: string }
  | { status: 'rejected' }
  | { status: 'forbidden' }

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function selectActiveTeamAction(
  formData: FormData,
): Promise<SelectActiveTeamActionResult> {
  const proposedTeamId = stringValue(formData.get('teamId'))

  if (!proposedTeamId) {
    return { status: 'rejected' }
  }

  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })

  if (access.status !== 'authenticated') {
    return { status: 'forbidden' }
  }

  const context = createActiveTeamNextServerContext()
  return context.select(access.userId, proposedTeamId)
}
