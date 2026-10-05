import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { externalIdentityLinks } from '@/db/schema'

export interface AssociateAuthorizedExternalIdentityInput {
  linkId: string
  userId: string
  provider: string
  subject: string
  linkedAt: string
}

export interface ExternalIdentityLinkRecord {
  id: string
  userId: string
  provider: string
  subject: string
  createdAt: string
}

/**
 * Persists an already-authorized external identity association.
 *
 * This boundary does not authenticate a provider session and must not be used
 * as proof that a client-supplied provider/subject belongs to the caller.
 * Token/session validation is a separate KAN-602 concern.
 */
export function associateAuthorizedExternalIdentity<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
  input: AssociateAuthorizedExternalIdentityInput,
): ExternalIdentityLinkRecord {
  return database.transaction((tx) => {
    const existing = tx
      .select({
        id: externalIdentityLinks.id,
        userId: externalIdentityLinks.userId,
        provider: externalIdentityLinks.provider,
        subject: externalIdentityLinks.subject,
        createdAt: externalIdentityLinks.createdAt,
      })
      .from(externalIdentityLinks)
      .where(and(
        eq(externalIdentityLinks.provider, input.provider),
        eq(externalIdentityLinks.subject, input.subject),
      ))
      .get()

    if (existing) {
      if (existing.userId !== input.userId) {
        throw new Error('External identity collision')
      }

      return existing
    }

    tx.insert(externalIdentityLinks).values({
      id: input.linkId,
      userId: input.userId,
      provider: input.provider,
      subject: input.subject,
      createdAt: input.linkedAt,
      updatedAt: input.linkedAt,
    }).run()

    return {
      id: input.linkId,
      userId: input.userId,
      provider: input.provider,
      subject: input.subject,
      createdAt: input.linkedAt,
    }
  })
}
