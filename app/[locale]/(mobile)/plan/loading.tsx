import { getTranslations } from 'next-intl/server'

export default async function PlanLoading() {
  const t = await getTranslations('AthletePlan')
  return (
    <main className='mx-auto w-full min-w-0 max-w-5xl px-4 py-6 sm:px-6'>
      <div role='status' aria-busy='true' className='rounded-2xl border bg-card p-6 text-sm text-muted-foreground'>
        <span className='inline-block animate-pulse'>{t('loading')}</span>
      </div>
    </main>
  )
}
