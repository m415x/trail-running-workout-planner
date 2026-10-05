export interface AuthenticatedExternalSubject {
  provider: string
  subject: string
}

export interface ExternalIdentityLookupRecord {
  linkId: string
  userId: string
  linkIsDeleted: boolean
  userIsDeleted: boolean
}

export interface ExternalIdentityLookup {
  findByProviderSubject(
    provider: string,
    subject: string,
  ): Promise<ExternalIdentityLookupRecord[]>
}

export type EptSessionIdentity =
  | { status: 'anonymous' }
  | { status: 'unlinked'; provider: string; subject: string }
  | { status: 'authenticated'; provider: string; subject: string; userId: string }
  | { status: 'invalid' }

/**
 * Resolves an already-validated external provider subject to the stable EPT User.
 *
 * This boundary does not validate Supabase tokens, authorize Team access, infer
 * identity from email/DNI, or grant capabilities. Any malformed or ambiguous
 * persistence state fails closed.
 */
export async function resolveAuthenticatedEptIdentity(
  externalSubject: AuthenticatedExternalSubject | null,
  lookup: ExternalIdentityLookup,
): Promise<EptSessionIdentity> {
  if (!externalSubject) {
    return { status: 'anonymous' }
  }

  const provider = externalSubject.provider.trim()
  const subject = externalSubject.subject.trim()

  if (!provider || !subject) {
    return { status: 'invalid' }
  }

  try {
    const links = await lookup.findByProviderSubject(provider, subject)

    if (links.length === 0) {
      return { status: 'unlinked', provider, subject }
    }

    if (links.length !== 1) {
      return { status: 'invalid' }
    }

    const [link] = links

    if (!link || link.linkIsDeleted || link.userIsDeleted || !link.userId.trim()) {
      return { status: 'invalid' }
    }

    return {
      status: 'authenticated',
      provider,
      subject,
      userId: link.userId,
    }
  } catch {
    return { status: 'invalid' }
  }
}
