import type { SupportedAuthLocale } from './safe-return-path'

export async function completeLogoutNavigation(input: {
  locale: SupportedAuthLocale
  signOut(): Promise<{ status: 'signed_out' | 'invalid' }>
  replace(path: string): void
  refresh(): void
}): Promise<'signed_out' | 'invalid'> {
  try {
    const outcome = await input.signOut()
    if (outcome.status !== 'signed_out') return 'invalid'
    input.replace(`/${input.locale}/login`)
    input.refresh()
    return 'signed_out'
  } catch {
    return 'invalid'
  }
}
