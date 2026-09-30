import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin, Mountain, Pencil, Route } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { getSessionAthleteAdjustmentReview } from '@/app/actions/athlete-session-adjustment-actions'
import {
  getSessionById,
  getSessionFormOptions,
  getSessionGenerationExplanationReview,
} from '@/app/actions/session-actions'
import { AthleteSessionAdjustmentReview } from '@/features/sessions/components/AthleteSessionAdjustmentReview'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface SessionDetailPageProps {
  params: Promise<{ locale: string; sessionId: string }>
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { locale, sessionId } = await params
  const session = await getSessionById(sessionId)
  const generationExplanationReview = await getSessionGenerationExplanationReview(sessionId)
  const athleteAdjustmentReview = await getSessionAthleteAdjustmentReview(sessionId)
  const { workouts } = await getSessionFormOptions(session?.workoutId ?? null)
  const t = await getTranslations('Sessions')
  const workoutTypeT = await getTranslations('Workouts')

  if (!session) notFound()

  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`
  const structureBlocks = [
    { label: t('form.structure.preliminaryExercises'), value: session.structure?.preliminaryExercises },
    { label: t('form.structure.warmup'), value: session.structure?.warmup },
    { label: t('form.structure.mainBlock'), value: session.structure?.mainBlock },
    { label: t('form.structure.cooldown'), value: session.structure?.cooldown },
  ].filter((block) => block.value)

  return (
    <div className='mx-auto w-full max-w-4xl space-y-6'>
      <Link href={sessionsPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft /> {t('routes.detail.back')}
      </Link>

      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{session.title}</h2>
          <p className='mt-1 flex items-center gap-2 text-muted-foreground'>
            <CalendarDays className='size-4' /> {formatDate(session.date, locale)}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge className='w-fit'>{workoutTypeT(`types.${session.type}`)}</Badge>
          <Link href={`${sessionsPath}/${session.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Pencil /> {t('routes.detail.edit')}
          </Link>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>{t('routes.detail.generalTitle')}</CardTitle>
            <CardDescription>{t('routes.detail.generalDescription')}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <DetailRow unspecified={t('routes.detail.unspecified')} icon={MapPin} label={t('routes.detail.location')} value={session.location?.name} />
            <DetailRow unspecified={t('routes.detail.unspecified')} icon={Mountain} label={t('routes.detail.template')} value={session.workout?.title} />
            <DetailRow unspecified={t('routes.detail.unspecified')} icon={Route} label={t('routes.detail.track')} value={session.trackPath} breakAll />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('routes.detail.notesTitle')}</CardTitle>
            <CardDescription>{t('routes.detail.notesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{session.notes || t('routes.detail.noNotes')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === 'en' ? 'Why it was generated this way' : 'Por qué se generó así'}
          </CardTitle>
          <CardDescription>
            {locale === 'en'
              ? 'Historical generation evidence by active prescription. Current ownership is shown separately from its generated origin.'
              : 'Evidencia histórica de generación por prescripción activa. El ownership actual se muestra separado de su origen generado.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generationExplanationReview.length > 0 ? (
            <div className='space-y-3'>
              {generationExplanationReview.map((item) => (
                <details
                  key={item.prescriptionId}
                  className='rounded-lg border bg-muted/20'
                >
                  <summary className='cursor-pointer list-none p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div>
                        <p className='font-medium'>
                          {item.planningScope.kind === 'variant'
                            ? (locale === 'en' ? 'Variant prescription' : 'Prescripción variante')
                            : (locale === 'en' ? 'Base prescription' : 'Prescripción base')}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {locale === 'en' ? 'Microcycle' : 'Microciclo'}: {item.planningScope.microcycleId}
                        </p>
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        <Badge variant='outline'>
                          {locale === 'en' ? 'Current ownership' : 'Ownership actual'}: {item.generationOwnership}
                        </Badge>
                        {item.planningScope.planningCohortId && (
                          <Badge variant='secondary'>
                            {locale === 'en' ? 'Planning subgroup' : 'Subgrupo'}: {item.planningScope.planningCohortId}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </summary>
                  <div className='space-y-3 border-t p-4'>
                    <p className='break-all text-xs text-muted-foreground'>
                      generationKey: {item.generationKey ?? '—'}
                    </p>
                    {item.generationExplanation.stages.map((stage) => (
                      <section key={stage.stage} className='space-y-1'>
                        <p className='text-sm font-medium'>{stage.stage}</p>
                        <p className='text-xs text-muted-foreground'>
                          {locale === 'en' ? 'Decisions' : 'Decisiones'}: {stage.decision.length}
                          {' · '}
                          {locale === 'en' ? 'Consequences' : 'Consecuencias'}: {stage.consequence.length}
                          {' · '}
                          {locale === 'en' ? 'Warnings' : 'Avisos'}: {stage.warnings.length}
                        </p>
                      </section>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>
              {locale === 'en'
                ? 'No historical generation explanation is available.'
                : 'No hay una explicación histórica disponible.'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('adjustments.title')}</CardTitle>
          <CardDescription>{t('adjustments.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AthleteSessionAdjustmentReview sessionId={session.id} items={athleteAdjustmentReview} workouts={workouts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('routes.detail.structureTitle')}</CardTitle>
          <CardDescription>{t('routes.detail.structureDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {structureBlocks.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{t('routes.detail.noStructure')}</p>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2'>
              {structureBlocks.map((block) => (
                <div key={block.label} className='rounded-lg border bg-muted/20 p-4'>
                  <h3 className='text-sm font-semibold'>{block.label}</h3>
                  <p className='mt-2 whitespace-pre-wrap text-sm text-muted-foreground'>{block.value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface DetailRowProps {
  icon: typeof MapPin
  label: string
  value?: string | null
  breakAll?: boolean
  unspecified: string
}

function DetailRow({ icon: Icon, label, value, breakAll = false, unspecified }: DetailRowProps) {
  return (
    <div className='flex items-start gap-3'>
      <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
      <div className='min-w-0'>
        <p className='font-medium'>{label}</p>
        <p className={breakAll ? 'break-all text-muted-foreground' : 'text-muted-foreground'}>{value || unspecified}</p>
      </div>
    </div>
  )
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
