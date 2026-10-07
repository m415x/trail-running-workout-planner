export interface PasswordRecoveryUpdateAuth {
  updateUser(input: {
    password: string
  }): Promise<{
    data: {
      user: {
        id?: string | null
      } | null
    }
    error: unknown
  }>
  signOut(): Promise<{
    error: unknown
  }>
}

export type PasswordRecoveryUpdateResult =
  | { status: 'updated' }
  | { status: 'invalid' }

export async function completePasswordRecovery(
  auth: PasswordRecoveryUpdateAuth,
  password: string,
): Promise<PasswordRecoveryUpdateResult> {
  const normalizedPassword = password.trim()

  if (!normalizedPassword) {
    return { status: 'invalid' }
  }

  try {
    const updateResult = await auth.updateUser({
      password: normalizedPassword,
    })

    if (
      updateResult.error
      || !updateResult.data.user?.id?.trim()
    ) {
      return { status: 'invalid' }
    }

    const signOutResult = await auth.signOut()

    if (signOutResult.error) {
      return { status: 'invalid' }
    }

    return { status: 'updated' }
  } catch {
    return { status: 'invalid' }
  }
}
