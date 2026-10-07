'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { authenticateEptLogin } from '@/lib/auth/login-flow'
import { requestPasswordRecovery } from '@/lib/auth/password-recovery-request'
import { completePasswordRecovery } from '@/lib/auth/password-recovery-update'
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


export type PasswordRecoveryRequestActionState =
  | { status: 'idle' }
  | { status: 'accepted' }
  | { status: 'error' }

export async function requestPasswordRecoveryAction(
  _previousState: PasswordRecoveryRequestActionState,
  formData: FormData,
): Promise<PasswordRecoveryRequestActionState> {
  const email = stringValue(formData.get('email'))
  const locale = localeValue(stringValue(formData.get('locale')))
  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin') ?? ''

  const supabase = await createSupabaseServerClient()
  const result = await requestPasswordRecovery({
    auth: supabase.auth,
    email,
    locale,
    origin,
  })

  if (result.status === 'accepted') {
    return { status: 'accepted' }
  }

  return { status: 'error' }
}


export type PasswordRecoveryUpdateActionState =
  | { status: 'idle' }
  | { status: 'invalid' }

export async function completePasswordRecoveryAction(
  _previousState: PasswordRecoveryUpdateActionState,
  formData: FormData,
): Promise<PasswordRecoveryUpdateActionState> {
  const password = stringValue(formData.get('password'))
  const locale = localeValue(stringValue(formData.get('locale')))

  const supabase = await createSupabaseServerClient()
  const result = await completePasswordRecovery(
    supabase.auth,
    password,
  )

  if (result.status === 'updated') {
    redirect(locale === 'en' ? '/en/login?recovery=updated' : '/es/login?recovery=updated')
  }

  return { status: 'invalid' }
}
