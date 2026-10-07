import type { EptSessionAccessState } from './ept-session-access'
import { resolveSafeAuthReturnPath, type SupportedAuthLocale } from './safe-return-path'

export interface RequireAuthenticatedSessionDeps {
  readAccess(): Promise<EptSessionAccessState>
}

export type RequireAuthenticatedSessionResult =
  | { status: 'authenticated'; userId: string }
  | { status: 'unlinked' }
  | { status: 'redirect'; location: string }

export async function requireAuthenticatedEptSession(
  deps: RequireAuthenticatedSessionDeps,
  options: {
    locale: SupportedAuthLocale
    returnTo?: string | null
  } = {
    locale: 'es',
  },
): Promise<RequireAuthenticatedSessionResult> {
  const access = await deps.readAccess()

  if (access.status === 'authenticated') {
    return {
      status: 'authenticated',
      userId: access.userId,
    }
  }

  if (access.status === 'unlinked') {
    return { status: 'unlinked' }
  }

  const safeReturnTo = resolveSafeAuthReturnPath(
    options.returnTo,
    options.locale,
  )

  return {
    status: 'redirect',
    location: `/${options.locale}/login?returnTo=${encodeURIComponent(safeReturnTo)}`,
  }
}
