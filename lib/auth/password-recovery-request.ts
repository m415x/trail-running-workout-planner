import type { SupportedAuthLocale } from './safe-return-path'

export interface PasswordRecoveryRequestAuth {
  resetPasswordForEmail(
    email: string,
    options: { redirectTo: string },
  ): Promise<{
    data: unknown
    error: unknown
  }>
}

export type PasswordRecoveryRequestResult =
  | { status: 'accepted' }
  | { status: 'error' }

function localizedRecoveryCallback(
  locale: SupportedAuthLocale,
  origin: string,
): string | null {
  try {
    const parsed = new URL(origin)

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null
    }

    const safeLocale = locale === 'en' ? 'en' : 'es'
    return new URL(`/${safeLocale}/auth/recovery/callback`, parsed.origin).toString()
  } catch {
    return null
  }
}

export async function requestPasswordRecovery(input: {
  auth: PasswordRecoveryRequestAuth
  email: string
  locale: SupportedAuthLocale
  origin: string
}): Promise<PasswordRecoveryRequestResult> {
  const redirectTo = localizedRecoveryCallback(input.locale, input.origin)

  if (!redirectTo) {
    return { status: 'error' }
  }

  try {
    const result = await input.auth.resetPasswordForEmail(
      input.email.trim(),
      { redirectTo },
    )

    if (result.error) {
      return { status: 'error' }
    }

    return { status: 'accepted' }
  } catch {
    return { status: 'error' }
  }
}
