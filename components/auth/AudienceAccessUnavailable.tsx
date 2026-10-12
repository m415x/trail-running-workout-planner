'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeLogoutNavigation } from '@/lib/auth/logout-navigation'
import { logoutAction } from '@/app/actions/auth-actions'
import type { SupportedAuthLocale } from '@/lib/auth/safe-return-path'

export function AudienceAccessUnavailable({ locale }: { locale: SupportedAuthLocale }) {
  const [failed, setFailed] = useState(false)
  const router = useRouter()
  return (
    <main className='mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6'>
      <h1 className='text-xl font-semibold'>{locale === 'es' ? 'Acceso no disponible' : 'Access unavailable'}</h1>
      <p>{locale === 'es' ? 'No se pudo determinar un equipo y acceso válidos.' : 'A valid team and access could not be determined.'}</p>
      {failed && <p role='alert'>{locale === 'es' ? 'No se pudo cerrar la sesión.' : 'Could not sign out.'}</p>}
      <button type='button' className='rounded-md border p-3' onClick={() => { setFailed(false); void completeLogoutNavigation({ locale, signOut: () => logoutAction(locale), replace: (path) => router.replace(path), refresh: () => router.refresh() }).then((result) => { if (result === 'invalid') setFailed(true) }) }}>
        {locale === 'es' ? 'Cerrar sesión' : 'Sign out'}
      </button>
    </main>
  )
}
