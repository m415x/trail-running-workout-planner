export interface PasswordRecoveryCodeAuth {
  exchangeCodeForSession(code: string): Promise<{
    data: {
      session: {
        access_token?: string | null
      } | null
      user: {
        id?: string | null
      } | null
    }
    error: unknown
  }>
}

export type PasswordRecoveryCodeResult =
  | { status: 'verified' }
  | { status: 'invalid' }

export async function exchangePasswordRecoveryCode(
  auth: PasswordRecoveryCodeAuth,
  code: string | null | undefined,
): Promise<PasswordRecoveryCodeResult> {
  const normalizedCode = code?.trim()

  if (!normalizedCode) {
    return { status: 'invalid' }
  }

  try {
    const result = await auth.exchangeCodeForSession(normalizedCode)

    if (result.error || !result.data.session || !result.data.user?.id?.trim()) {
      return { status: 'invalid' }
    }

    return { status: 'verified' }
  } catch {
    return { status: 'invalid' }
  }
}
