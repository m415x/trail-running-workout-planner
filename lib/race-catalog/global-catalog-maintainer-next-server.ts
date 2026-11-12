import { createNextServerIdentityEvidence } from '@/lib/auth/identity-backend-next-server'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'

/** Private server configuration; never derive authority from a Team or request. */
function isCanonicalUserId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1 && value.length <= 256
    && value.trim() === value
    && !Array.from(value).some(character => {
      const code = character.codePointAt(0)!
      return code <= 31 || (code >= 127 && code <= 159)
    })
}

function parseMaintainers(raw: string | undefined): ReadonlySet<string> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const ids = new Set<string>()
    for (const id of parsed) {
      if (!isCanonicalUserId(id) || ids.has(id)) return null
      ids.add(id)
    }
    return ids
  } catch {
    return null
  }
}

/** Fresh H2 evidence and configuration on every invocation; only a boolean leaves this boundary. */
export async function canMaintainGlobalRaceCatalog(): Promise<boolean> {
  try {
    const client = await createSupabaseServerClient()
    const access = await requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(client.auth, createNextServerIdentityEvidence().lookup),
    })
    if (access.status !== 'authenticated' || !isCanonicalUserId(access.userId)) return false

    const maintainers = parseMaintainers(process.env.RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS)
    return maintainers?.has(access.userId) === true
  } catch {
    // Unavailable identity infrastructure is not authority. Never log private configuration.
    return false
  }
}
