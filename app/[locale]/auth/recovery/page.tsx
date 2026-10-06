import { getTranslations } from 'next-intl/server'

import { RecoveryRequestForm } from './RecoveryRequestForm'

export default async function RecoveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const { locale: rawLocale } = await params
  const { error } = await searchParams
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const t = await getTranslations({ locale, namespace: 'Recovery' })
  const invalidLink = error === 'recovery_invalid'

  return (
    <main className='flex min-h-dvh items-center justify-center p-6'>
      <section className='flex w-full max-w-sm flex-col gap-6'>
        <header className='space-y-2'>
          <h1 className='text-2xl font-semibold'>{t('requestTitle')}</h1>
          <p className='text-sm text-muted-foreground'>
            {t('requestDescription')}
          </p>
        </header>

        {invalidLink ? (
          <p role='alert' className='text-sm text-destructive'>
            {t('invalidLink')}
          </p>
        ) : null}

        <RecoveryRequestForm locale={locale} />

        <a
          href={locale === 'en' ? '/en/login' : '/es/login'}
          className='text-sm underline underline-offset-4'
        >
          {t('backToLogin')}
        </a>
      </section>
    </main>
  )
}
