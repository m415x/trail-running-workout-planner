import {
  ACTIVE_TEAM_COOKIE_NAME,
  activeTeamCookie,
  clearActiveTeamCookie,
  validateActiveTeamSelection,
  type ActiveTeamSelectionMembership,
  type ActiveTeamCookie,
} from './active-team-selection'
import {
  resolveActiveTeamContext,
  type ActiveTeamContextResult,
} from './active-team-context'

export interface ActiveTeamCookieStore {
  get(name: string): { value: string } | undefined
  set(
    name: string,
    value: string,
    options: ActiveTeamCookie['options'],
  ): void
}

export interface CreateActiveTeamServerContextInput {
  cookies(): Promise<ActiveTeamCookieStore>
  loadMemberships(userId: string): Promise<readonly ActiveTeamSelectionMembership[]>
  now(): string
  secureCookies: boolean
}

function persistedTeamId(store: ActiveTeamCookieStore): string | null {
  const value = store.get(ACTIVE_TEAM_COOKIE_NAME)?.value?.trim()
  return value ? value : null
}

export function createActiveTeamServerContext(
  input: CreateActiveTeamServerContextInput,
) {
  return {
    async resolve(userId: string): Promise<ActiveTeamContextResult> {
      const [store, memberships] = await Promise.all([
        input.cookies(),
        input.loadMemberships(userId),
      ])

      return resolveActiveTeamContext({
        persistedTeamId: persistedTeamId(store),
        memberships,
        onDate: input.now(),
      })
    },

    async select(userId: string, proposedTeamId: string) {
      const memberships = await input.loadMemberships(userId)
      const result = validateActiveTeamSelection({
        userId,
        proposedTeamId,
        at: input.now(),
        memberships,
      })

      if (result.status !== 'accepted') {
        return result
      }

      const store = await input.cookies()
      const cookie = activeTeamCookie(result.teamId, {
        secure: input.secureCookies,
      })
      store.set(cookie.name, cookie.value, cookie.options)

      return result
    },

    async clear(): Promise<void> {
      const store = await input.cookies()
      const cookie = clearActiveTeamCookie({
        secure: input.secureCookies,
      })
      store.set(cookie.name, cookie.value, cookie.options)
    },
  }
}
