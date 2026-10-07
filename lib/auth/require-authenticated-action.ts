import type { EptSessionAccessState } from './ept-session-access'

export interface RequireAuthenticatedActionDeps {
  readAccess(): Promise<EptSessionAccessState>
}

export type RequireAuthenticatedActionResult =
  | {
      status: 'authenticated'
      userId: string
    }
  | {
      status: 'forbidden'
      reason: 'anonymous' | 'unlinked' | 'invalid'
    }

export async function requireAuthenticatedEptAction(
  deps: RequireAuthenticatedActionDeps,
): Promise<RequireAuthenticatedActionResult> {
  const access = await deps.readAccess()

  if (access.status === 'authenticated') {
    return {
      status: 'authenticated',
      userId: access.userId,
    }
  }

  if (access.status === 'unlinked') {
    return {
      status: 'forbidden',
      reason: 'unlinked',
    }
  }

  if (access.status === 'anonymous') {
    return {
      status: 'forbidden',
      reason: 'anonymous',
    }
  }

  return {
    status: 'forbidden',
    reason: 'invalid',
  }
}
