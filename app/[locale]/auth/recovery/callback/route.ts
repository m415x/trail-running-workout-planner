import { NextResponse } from 'next/server'

import { exchangePasswordRecoveryCode } from '@/lib/auth/password-recovery-code'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'

export async function GET(
  request: Request,
  context: { params: Promise<{ locale: string }> },
) {
  const { locale: rawLocale } = await context.params
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  const supabase = await createSupabaseServerClient()
  const result = await exchangePasswordRecoveryCode(
    supabase.auth,
    code,
  )

  if (result.status === 'verified') {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/recovery/reset`, url.origin),
    )
  }

  return NextResponse.redirect(
    new URL(
      `/${locale}/auth/recovery?error=recovery_invalid`,
      url.origin,
    ),
  )
}
