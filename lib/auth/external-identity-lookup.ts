import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { externalIdentityLinks, users } from '@/db/schema'
import type {
  ExternalIdentityLookup,
  ExternalIdentityLookupRecord,
} from './server-session-identity'

export interface ExternalIdentityLookupSource {
  findByProviderSubject(
    provider: string,
    subject: string,
  ): Promise<ExternalIdentityLookupRecord[]>
}

export function createExternalIdentityLookup(
  source: ExternalIdentityLookupSource = {
    async findByProviderSubject(provider, subject) {
      const rows = await db
        .select({
          linkId: externalIdentityLinks.id,
          userId: externalIdentityLinks.userId,
          linkIsDeleted: externalIdentityLinks.isDeleted,
          userIsDeleted: users.isDeleted,
        })
        .from(externalIdentityLinks)
        .innerJoin(users, eq(externalIdentityLinks.userId, users.id))
        .where(and(
          eq(externalIdentityLinks.provider, provider),
          eq(externalIdentityLinks.subject, subject),
          eq(externalIdentityLinks.isDeleted, false),
          eq(users.isDeleted, false),
        ))

      return rows
    },
  },
): ExternalIdentityLookup {
  return {
    findByProviderSubject(provider, subject) {
      return source.findByProviderSubject(provider, subject)
    },
  }
}
