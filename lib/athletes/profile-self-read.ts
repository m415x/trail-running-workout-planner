import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { athleteProfiles } from '@/db/schema'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createH5aSelfNextServerContext } from '@/lib/authorization/h5a-self-next-server'

/**
 * Explicit Profile header projection. No raw identity, contact, medical,
 * historic physiology, field evidence, or administrative write authority.
 */
export interface ProfileSelfHeader {
  readonly id: string
  readonly teamId: string
  readonly firstName: string | null
  readonly lastName: string | null
  readonly nickName: string | null
  readonly group: {
    readonly categoryCode: string
    readonly levelCode: string
  } | null
}

export type ProfileSelfReadResult =
  | { readonly status: 'loaded'; readonly athleteProfile: ProfileSelfHeader }
  | { readonly status: 'denied' }
  | { readonly status: 'error' }

/**
 * Resolve subject anew for every request: authenticated EPT User -> active Team
 * -> effective TeamMembership -> unique active AthleteProfile.
 * No caller-controlled athlete/team IDs are accepted.
 */
export async function readCurrentAthleteProfile(): Promise<ProfileSelfReadResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const lookup = createExternalIdentityLookup()
    const access = await requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    })
    if (access.status !== 'authenticated') return { status: 'denied' }

    const self = await createH5aSelfNextServerContext().resolve(access, {
      at: new Date().toISOString(),
      capability: 'planning.self.read',
    })
    if (self.status !== 'resolved') return { status: 'denied' }

    const athleteProfile = await db.query.athleteProfiles.findFirst({
      where: and(
        eq(athleteProfiles.id, self.athleteProfileId),
        eq(athleteProfiles.userId, self.userId),
        eq(athleteProfiles.teamId, self.teamId),
        eq(athleteProfiles.isActive, true),
        eq(athleteProfiles.isDeleted, false),
      ),
      columns: {
        id: true,
        teamId: true,
        firstName: true,
        lastName: true,
        nickName: true,
      },
      with: {
        group: {
          columns: { categoryCode: true, levelCode: true },
        },
      },
    })
    if (!athleteProfile) return { status: 'denied' }

    return {
      status: 'loaded',
      athleteProfile: {
        id: athleteProfile.id,
        teamId: athleteProfile.teamId,
        firstName: athleteProfile.firstName,
        lastName: athleteProfile.lastName,
        nickName: athleteProfile.nickName,
        group: athleteProfile.group
          ? {
              categoryCode: athleteProfile.group.categoryCode,
              levelCode: athleteProfile.group.levelCode,
            }
          : null,
      },
    }
  } catch {
    return { status: 'error' }
  }
}
