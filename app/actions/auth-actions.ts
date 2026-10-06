'use server'

import { redirect } from 'next/navigation'

import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { authenticateEptLogin } from '@/lib/auth/login-flow'
import type { SupportedAuthLocale } from '@/lib/auth/safe-return-path'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'

export type LoginActionState =
  | { status: 'idle' }
  | { status: 'invalid_credentials' }
  | { status: 'unlinked' }
  | { status: 'invalid' }

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

function localeValue(value: string): SupportedAuthLocale {
  return value === 'en' ? 'en' : 'es'
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = stringValue(formData.get('email'))
  const password = stringValue(formData.get('password'))
  const locale = localeValue(stringValue(formData.get('locale')))
  const returnTo = stringValue(formData.get('returnTo')) || null

  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()

  const result = await authenticateEptLogin({
    auth: supabase.auth,
    lookup,
    email,
    password,
    locale,
    returnTo,
  })

  if (result.status === 'authenticated') {
    redirect(result.returnTo)
  }

  if (result.status === 'invalid_credentials') {
    return { status: 'invalid_credentials' }
  }

  if (result.status === 'unlinked') {
    return { status: 'unlinked' }
  }

  return { status: 'invalid' }
}


export async function logoutAction(
  locale: SupportedAuthLocale,
): Promise<{ status: 'invalid' }> {
  const supabase = await createSupabaseServerClient()
  const signOutResult = await supabase.auth.signOut()

  if (signOutResult.error) {
    return { status: 'invalid' }
  }

  redirect(locale === 'en' ? '/en/login' : '/es/login')
}
