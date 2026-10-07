import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'

import { db } from '@/db'
import { teamMemberships } from '@/db/schema'

import {
  createActiveTeamServerContext,
  type ActiveTeamCookieStore,
} from './active-team-server-context'

export function createActiveTeamNextServerContext() {
  return createActiveTeamServerContext({
    cookies: async (): Promise<ActiveTeamCookieStore> => {
      const store = await cookies()

      return {
        get(name) {
          const cookie = store.get(name)
          return cookie ? { value: cookie.value } : undefined
        },
        set(name, value, options) {
          store.set(name, value, options)
        },
      }
    },

    async loadMemberships(userId) {
      return db
        .select({
          userId: teamMemberships.userId,
          teamId: teamMemberships.teamId,
          effectiveFrom: teamMemberships.effectiveFrom,
          effectiveUntil: teamMemberships.effectiveUntil,
          isActive: teamMemberships.isActive,
          isDeleted: teamMemberships.isDeleted,
        })
        .from(teamMemberships)
        .where(eq(teamMemberships.userId, userId))
        .all()
    },

    now: () => new Date().toISOString(),
    secureCookies: process.env.NODE_ENV === 'production',
  })
}
