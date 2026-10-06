import { getTranslations } from 'next-intl/server'

import { LoginForm } from './LoginForm'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ returnTo?: string | string[]; recovery?: string | string[] }>
}) {
  const { locale: rawLocale } = await params
  const { returnTo: rawReturnTo, recovery } = await searchParams
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const returnTo = typeof rawReturnTo === 'string' ? rawReturnTo : ''
  const t = await getTranslations({ locale, namespace: 'Login' })

  return (
    <main className='flex min-h-dvh items-center justify-center p-6'>
      <section className='flex w-full max-w-sm flex-col gap-6'>
        <header className='space-y-2'>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-sm text-muted-foreground'>{t('description')}</p>
        </header>

        {recovery === 'updated' ? (
          <p role='status' className='text-sm text-muted-foreground'>
            {t('recoveryUpdated')}
          </p>
        ) : null}

        <LoginForm locale={locale} returnTo={returnTo} />
      </section>
    </main>
  )
}
