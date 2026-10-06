import { getTranslations } from 'next-intl/server'

export default async function UnlinkedPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const t = await getTranslations({ locale, namespace: 'Unlinked' })

  return (
    <main className='flex min-h-dvh items-center justify-center p-6'>
      <section className='flex w-full max-w-sm flex-col gap-4 text-center'>
        <h1 className='text-2xl font-semibold'>{t('title')}</h1>
        <p className='text-sm text-muted-foreground'>{t('description')}</p>
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
