import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Activity, ArrowLeft, CalendarRange, EllipsisVertical, Flag, Mail, Pencil, Phone, ReceiptText, ShieldAlert, Target, UsersRound } from 'lucide-react'

import { AthleteRaceRegistrationForm } from '@/features/race-registration/components/AthleteRaceRegistrationForm'
import { AthleteBillingTermsForm } from '@/features/memberships/components/AthleteBillingTermsForm'
import { CoachTrack1000mForm } from '@/features/field-performance-test/components/CoachTrack1000mForm'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { getCoachPendingTrack1000mEvidenceAction, getCoachTrack1000mHistoryAction, getCoachTrack1000mTestEventsAction } from '@/app/actions/field-performance-test-actions'
import { getAthletePlanningResolutionOnDate } from '@/app/actions/planning-cohort-actions'
import { getTrainingGoalsForAthlete } from '@/app/actions/training-goal-actions'
import { db } from '@/db'
import { createAthleteMembershipPageLoader } from '@/lib/memberships/athlete-membership-page-loader'
import { getAthleteBillingTermsFormModel } from '@/lib/memberships/athlete-billing-terms-form-model'
import { createDrizzleBillingDatabase } from '@/lib/memberships/billing-drizzle-database'
import { createSqliteBillingPersistencePort } from '@/lib/memberships/billing-sqlite-persistence'
import { projectAthleteRaceCompetition } from '@/lib/competitions/race-registration-application'
import { listRaceCourses, listRaceEditions, listRaceEvents } from '@/lib/race-catalog/catalog-repository'
import { listRaceRegistrationsForAthlete } from '@/lib/competitions/race-registration-repository'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@ui/accordion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu'

interface AthleteDetailPageProps {
  params: Promise<{ locale: string; athleteId: string }>
}

function athletePath(locale: string, suffix = '') {
  const base = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  return `${base}${suffix}`
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function CoachTrack1000mPanel({ athleteId, locale, events, pending, eventsError, pendingError, historyResult, labels }: { athleteId: string; locale: string; events: Array<{ id: string; scheduledAt: string }>; pending: Array<{ id: string; performedAt: string; elapsedTimeSec: number }>; eventsError: boolean; pendingError: boolean; historyResult: Awaited<ReturnType<typeof getCoachTrack1000mHistoryAction>>; labels: { faster: string; slower: string; same: string; insufficientEvidence: string; unavailable: string; historyLoadError: string } }) {
  const evolution = historyResult.success ? historyResult.data.evolution : null
  const factualTrend = evolution?.comparison.state === 'available'
    ? evolution.comparison.direction === 'decreasing'
      ? labels.faster
      : evolution.comparison.direction === 'increasing'
        ? labels.slower
        : labels.same
    : labels.insufficientEvidence
  const reference = historyResult.success && historyResult.data.reference.status === 'available'
    ? `${historyResult.data.reference.derived.paceLabel} · ${historyResult.data.reference.derived.averageSpeedKmh.toFixed(2)} km/h`
    : labels.unavailable

  return <Card className='md:col-span-2'>
    <CardHeader><CardTitle>Test 1000 m</CardTitle></CardHeader>
    <CardContent>
      {historyResult.success
        ? <CoachTrack1000mForm athleteId={athleteId} locale={locale} events={events} pendingEvidence={pending} history={historyResult.data.history} reference={reference} factualTrend={factualTrend} eventsError={eventsError} pendingError={pendingError} />
        : <p role='alert' className='text-sm text-destructive'>{labels.historyLoadError}</p>}
    </CardContent>
  </Card>
}
function DetailItem({ label, value, fallback }: { label: string; value: string | null | undefined; fallback: string }) {
  return <div><dt className='text-sm text-muted-foreground'>{label}</dt><dd className='mt-1 font-medium'>{value || fallback}</dd></div>
}

export default async function AthleteDetailPage({ params }: AthleteDetailPageProps) {
  const { locale, athleteId } = await params
  const tActions = await getTranslations({ locale, namespace: 'AthleteActions' })
  const t = await getTranslations({ locale, namespace: 'AthleteDetail' })
  const today = todayInArgentina()
  const [athlete, planningResult, goals, testEventsResult, pendingEvidenceResult, testHistoryResult] = await Promise.all([
    getAthleteById(athleteId),
    getAthletePlanningResolutionOnDate(athleteId, today),
    getTrainingGoalsForAthlete(athleteId),
    getCoachTrack1000mTestEventsAction(athleteId),
    getCoachPendingTrack1000mEvidenceAction(athleteId),
    getCoachTrack1000mHistoryAction(athleteId, today),
  ])
  if (!athlete) notFound()

  const membershipLoader = createAthleteMembershipPageLoader({
    createPort: (database: typeof db) =>
      createSqliteBillingPersistencePort(createDrizzleBillingDatabase(database)),
  })
  const membership = await membershipLoader({
    db,
    locale: locale === 'en' ? 'en' : 'es',
    teamId: athlete.teamId,
    athleteId,
    onDate: today,
  })

  const raceCompetition = projectAthleteRaceCompetition(listRaceRegistrationsForAthlete({ teamId: athlete.teamId, athleteProfileId: athleteId }))
  const raceEvents = listRaceEvents()
  const raceEditions = raceEvents.flatMap((event) => listRaceEditions(event.id))
  const raceCourses = raceEditions.flatMap((edition) => listRaceCourses(edition.id))
  const upcomingRegistrations = raceCompetition.upcomingRegistrations
  const history = raceCompetition.history
  const es = locale === 'es'
  const membershipTermsForm = getAthleteBillingTermsFormModel({
    locale: es ? 'es' : 'en',
    currentTerms: membership.currentTerms
      ? {
          monthlyAmountMinor: membership.currentTerms.monthlyAmountMinor,
          currency: membership.currentTerms.currency,
        }
      : null,
  })
  const participationLabels: Record<string, string> = es
    ? { started: 'Inició', finished: 'Finalizó', dnf: 'DNF', dns: 'DNS', unknown: 'Desconocido' }
    : { started: 'Started', finished: 'Finished', dnf: 'DNF', dns: 'DNS', unknown: 'Unknown' }
  const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`
  const groupCode = athlete.group ? `${athlete.group.categoryCode}${athlete.group.levelCode}` : null
  const listPath = athletePath(locale)
  const editPath = athletePath(locale, `/${athlete.id}/edit`)
  const groupPath = athletePath(locale, `/${athlete.id}/group`)
  const trainingPath = athletePath(locale, `/${athlete.id}/training`)
  const newGoalPath = athletePath(locale, `/${athlete.id}/goals/new`)
  const planningBasePath = es ? '/dashboard/planning' : `/${locale}/dashboard/planning`

  return (
    <div className='mx-auto w-full max-w-5xl space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-4'>
          <Link href={listPath} aria-label={t('backToList')} className={buttonVariants({ variant: 'ghost', size: 'icon' })}><ArrowLeft /></Link>
          <Avatar className='size-14'><AvatarImage src={athlete.user.avatar ?? undefined} alt={fullName} /><AvatarFallback>{getInitials(athlete.user.firstName, athlete.user.lastName)}</AvatarFallback></Avatar>
          <div><div className='flex flex-wrap items-center gap-2'><h2 className='text-3xl font-bold tracking-tight'>{fullName}</h2>{athlete.isActive ? <Badge variant='outline' className='border-emerald-500/40 text-emerald-700 dark:text-emerald-400'>{t('active')}</Badge> : <Badge variant='outline' className='text-muted-foreground'>{t('inactive')}</Badge>}</div><p className='text-muted-foreground'>{athlete.nickName ? `“${athlete.nickName}”` : t('profile')}</p></div>
        </div>
        <DropdownMenu><DropdownMenuTrigger className={buttonVariants({ variant: 'outline' })} aria-label={tActions('menuFor', { name: fullName })}>{tActions('actions')}<EllipsisVertical /></DropdownMenuTrigger><DropdownMenuContent align='end' className='w-56'><DropdownMenuItem render={<Link href={trainingPath} />}><Activity />{tActions('realizedTraining')}</DropdownMenuItem><DropdownMenuItem render={<Link href={newGoalPath} />}><Target />{tActions('newGoal')}</DropdownMenuItem><DropdownMenuItem render={<Link href={groupPath} />}><UsersRound />{athlete.groupId ? tActions('changeGroup') : tActions('assignGroup')}</DropdownMenuItem><DropdownMenuItem render={<Link href={editPath} />}><Pencil />{tActions('editAthlete')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <CoachTrack1000mPanel athleteId={athleteId} locale={locale} labels={{ faster: t('faster'), slower: t('slower'), same: t('same'), insufficientEvidence: t('insufficientEvidence'), unavailable: t('unavailable'), historyLoadError: t('historyLoadError') }} events={testEventsResult.success ? testEventsResult.data : []} pending={pendingEvidenceResult.success ? pendingEvidenceResult.data : []} eventsError={!testEventsResult.success} pendingError={!pendingEvidenceResult.success} historyResult={testHistoryResult} />
        <Card><CardHeader><CardTitle>{t('personalData')}</CardTitle></CardHeader><CardContent><dl className='grid gap-5 sm:grid-cols-2'><DetailItem label='DNI' value={athlete.dni} fallback={t('notProvided')} /><DetailItem label={t('birthDate')} value={formatDate(athlete.birthday, locale, t('notProvided'))} fallback={t('notProvided')} /><DetailItem label={t('nickname')} value={athlete.nickName} fallback={t('notProvided')} /><div><dt className='text-sm text-muted-foreground'>{t('group')}</dt><dd className='mt-1'>{groupCode ? <Badge variant='secondary'>{groupCode}</Badge> : <Badge variant='outline'>{t('noGroup')}</Badge>}</dd></div></dl></CardContent></Card>
        <Card><CardHeader><CardTitle>{t('contact')}</CardTitle></CardHeader><CardContent className='space-y-5'><div className='flex gap-3'><Mail className='mt-0.5 size-4 text-muted-foreground' /><div><p className='text-sm text-muted-foreground'>Email</p><p className='font-medium'>{athlete.user.email}</p></div></div><div className='flex gap-3'><Phone className='mt-0.5 size-4 text-muted-foreground' /><div><p className='text-sm text-muted-foreground'>{t('phone')}</p><p className='font-medium'>{athlete.phone || t('notProvided')}</p></div></div></CardContent></Card>

        <Card className='md:col-span-2'>
          <CardHeader><CardTitle className='flex items-center gap-2'><ReceiptText className='size-5' />{membership.title}</CardTitle></CardHeader>
          <CardContent className='space-y-6'>
            <section className='space-y-3'>
              {membership.currentTerms ? (
                <dl className='grid gap-4 sm:grid-cols-3'>
                  <DetailItem label={locale === 'en' ? 'Monthly amount' : 'Importe mensual'} value={membership.currentTerms.monthlyAmount} fallback='—' />
                  <DetailItem label={locale === 'en' ? 'Currency' : 'Moneda'} value={membership.currentTerms.currency} fallback='—' />
                  <DetailItem label={locale === 'en' ? 'Effective from' : 'Vigente desde'} value={formatDate(membership.currentTerms.effectiveFrom, locale, '—')} fallback='—' />
                </dl>
              ) : <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{membership.emptyTerms}</p>}
            </section>
            {membership.scheduledTerms.length > 0 && (
              <Accordion type='single' collapsible>
                <AccordionItem value='scheduled-terms' className='overflow-hidden rounded-lg border border-border bg-card'>
                  <AccordionTrigger className='px-4 py-3 text-base font-semibold hover:no-underline'>
                    {locale === 'en' ? `Scheduled changes (${membership.scheduledTerms.length})` : `Cambios programados (${membership.scheduledTerms.length})`}
                  </AccordionTrigger>
                  <AccordionContent className='px-4 pb-4'>
                    <div className='divide-y divide-border'>
                      {membership.scheduledTerms.map((terms) => (
                        <dl key={terms.effectiveFrom} className='grid gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-3'>
                          <DetailItem label={locale === 'en' ? 'Monthly amount' : 'Importe mensual'} value={terms.monthlyAmount} fallback='—' />
                          <DetailItem label={locale === 'en' ? 'Currency' : 'Moneda'} value={terms.currency} fallback='—' />
                          <DetailItem label={locale === 'en' ? 'Effective from' : 'Vigente desde'} value={formatDate(terms.effectiveFrom, locale, '—')} fallback='—' />
                        </dl>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
            {membership.pastTerms.length > 0 && (
              <Accordion type='single' collapsible>
                <AccordionItem value='past-terms' className='overflow-hidden rounded-lg border border-border bg-card'>
                  <AccordionTrigger className='px-4 py-3 text-base font-semibold hover:no-underline'>
                    {locale === 'en' ? `Terms history (${membership.pastTerms.length})` : `Historial de condiciones (${membership.pastTerms.length})`}
                  </AccordionTrigger>
                  <AccordionContent className='px-4 pb-4'>
                    <div className='divide-y divide-border'>
                      {membership.pastTerms.map((terms) => (
                        <dl key={terms.effectiveFrom} className='grid gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-4'>
                          <DetailItem label={locale === 'en' ? 'Monthly amount' : 'Importe mensual'} value={terms.monthlyAmount} fallback='—' />
                          <DetailItem label={locale === 'en' ? 'Currency' : 'Moneda'} value={terms.currency} fallback='—' />
                          <DetailItem label={locale === 'en' ? 'Effective from' : 'Vigente desde'} value={formatDate(terms.effectiveFrom, locale, '—')} fallback='—' />
                          <DetailItem label={locale === 'en' ? 'Effective until' : 'Vigente hasta'} value={formatDate(terms.effectiveUntil, locale, '—')} fallback='—' />
                        </dl>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
            <section className='space-y-3'>
              <h3 className='font-medium'>{locale === 'en' ? 'Materialized charges' : 'Cuotas materializadas'}</h3>
              {membership.charges.length === 0 ? (
                <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{membership.emptyCharges}</p>
              ) : (
                <div className='space-y-3'>
                  {membership.charges.map((charge) => (
                    <dl key={charge.period} className='grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-3'>
                      <DetailItem label={locale === 'en' ? 'Period' : 'Período'} value={charge.period} fallback='—' />
                      <DetailItem label={locale === 'en' ? 'Amount' : 'Importe'} value={charge.amountDue} fallback='—' />
                      <DetailItem label={locale === 'en' ? 'Due date' : 'Vencimiento'} value={formatDate(charge.effectiveDueDate, locale, '—')} fallback='—' />
                    </dl>
                  ))}
                </div>
              )}
            </section>
            <AthleteBillingTermsForm
              athleteId={athleteId}
              locale={es ? 'es' : 'en'}
              model={membershipTermsForm}
            />
          </CardContent>
        </Card>

        <Card className='md:col-span-2'><CardHeader><div className='flex flex-wrap items-center justify-between gap-3'><CardTitle className='flex items-center gap-2'><Target className='size-5' />{t('goals')}</CardTitle><Link href={newGoalPath} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{t('newGoal')}</Link></div></CardHeader><CardContent>{goals.length === 0 ? <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{t('noGoals')}</p> : <div className='space-y-3'>{goals.map((goal) => <div key={goal.id} className='rounded-lg border p-4'><div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start'><div className='min-w-0'><div className='flex flex-wrap items-center gap-2'><p className='font-medium'>{goal.title}</p><Badge variant={goal.status === 'draft' ? 'outline' : 'secondary'}>{goal.status === 'draft' ? t('goalDraft') : goal.status === 'active' ? t('active') : goal.status === 'completed' ? t('goalCompleted') : goal.status === 'cancelled' ? t('goalCancelled') : goal.status}</Badge></div>{goal.type === 'race' && goal.raceName && goal.raceName !== goal.title && <p className='mt-1 text-sm text-muted-foreground'>{goal.raceName}</p>}{goal.description && <p className='mt-2 text-sm'>{goal.description}</p>}{goal.notes && <p className='mt-2 text-sm text-muted-foreground'>{goal.notes}</p>}</div><dl className='grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:min-w-[24rem] lg:text-right'><div><dt className='text-muted-foreground'>{t('date')}</dt><dd className='mt-0.5 font-medium'>{formatDate(goal.targetDate, locale, t('notProvided'))}</dd></div>{goal.type === 'race' && <><div><dt className='text-muted-foreground'>{t('distance')}</dt><dd className='mt-0.5 font-medium'>{goal.raceDistanceKm == null ? '—' : `${goal.raceDistanceKm} km`}</dd></div><div><dt className='text-muted-foreground'>D+</dt><dd className='mt-0.5 font-medium'>{goal.raceElevationGain == null ? '—' : `+${goal.raceElevationGain} m`}</dd></div></>}</dl></div></div>)}</div>}</CardContent></Card>

        <Card className='md:col-span-2'>
          <CardHeader><CardTitle className='flex items-center gap-2'><Flag className='size-5' />{t('competitions')}</CardTitle></CardHeader>
          <CardContent className='space-y-6'>
            <section className='space-y-3'>
              <h3 className='font-medium'>{t('registerCompetition')}</h3>
              {raceCourses.length === 0 ? (
                <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
                  {t('noCourses')}
                </p>
              ) : (
                <AthleteRaceRegistrationForm
                  athleteProfileId={athleteId}
                  locale={locale}
                  editions={raceEditions.map((edition) => ({ id: edition.id, label: edition.label }))}
                  courses={raceCourses.map((course) => ({ id: course.id, label: course.label, raceEditionId: course.raceEditionId }))}
                />
              )}
            </section>
            <section className='space-y-3'>
              <h3 className='font-medium'>{t('upcomingRegistrations')}</h3>
              {upcomingRegistrations.length === 0 ? <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{t('noUpcomingRegistrations')}</p> : upcomingRegistrations.map((registration) => <div key={`${registration.editionDate}-${registration.courseLabel}`} className='rounded-lg border p-4'><p className='font-medium'>{registration.eventName} · {registration.editionLabel}</p><p className='mt-1 text-sm text-muted-foreground'>{registration.courseLabel} · {formatDate(registration.editionDate, locale, t('notProvided'))}</p><div className='mt-2 flex flex-wrap gap-3 text-sm'><span>{t('nominalDistance')}: {registration.nominalDistanceKm == null ? '—' : `${registration.nominalDistanceKm} km`}</span><span>D+: {registration.nominalElevationGainM == null ? '—' : `+${registration.nominalElevationGainM} m`}</span></div></div>)}
            </section>
            <section className='space-y-3'>
              <h3 className='font-medium'>{t('participationHistory')}</h3>
              {history.length === 0 ? <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{t('noParticipationHistory')}</p> : history.map((registration) => <div key={`${registration.editionDate}-${registration.courseLabel}`} className='rounded-lg border p-4'><div className='flex flex-wrap items-center gap-2'><p className='font-medium'>{registration.eventName} · {registration.editionLabel}</p><Badge variant='outline'>{participationLabels[registration.participationStatus] ?? registration.participationStatus}</Badge></div><p className='mt-1 text-sm text-muted-foreground'>{registration.courseLabel} · {formatDate(registration.editionDate, locale, t('notProvided'))}</p><dl className='mt-3 grid gap-3 text-sm sm:grid-cols-4'><div><dt className='text-muted-foreground'>{t('nominalDistance')}</dt><dd>{registration.nominalDistanceKm == null ? '—' : `${registration.nominalDistanceKm} km`}</dd></div><div><dt className='text-muted-foreground'>D+</dt><dd>{registration.nominalElevationGainM == null ? '—' : `+${registration.nominalElevationGainM} m`}</dd></div><div><dt className='text-muted-foreground'>{t('actualDistance')}</dt><dd>{registration.actualDistanceKm == null ? '—' : `${registration.actualDistanceKm} km`}</dd></div><div><dt className='text-muted-foreground'>{t('elapsedTime')}</dt><dd>{registration.elapsedTimeSeconds == null ? '—' : `${registration.elapsedTimeSeconds} s`}</dd></div></dl></div>)}
            </section>
          </CardContent>
        </Card>

        <Card className='md:col-span-2'><CardHeader><CardTitle className='flex items-center gap-2'><CalendarRange className='size-5' />{t('planningToday')}</CardTitle></CardHeader><CardContent>{planningResult?.resolution.status === 'resolved' ? <div className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'><div><div className='flex flex-wrap items-center gap-2'><p className='font-medium'>{planningResult.planTitle ?? t('planningUntitled')}</p><Badge variant={planningResult.resolution.source === 'cohort' ? 'default' : 'secondary'}>{planningResult.resolution.source === 'cohort' ? t('cohort') : t('groupPlan')}</Badge></div><p className='mt-1 text-sm text-muted-foreground'>{planningResult.resolution.source === 'cohort' ? t('cohortVariant', { cohort: planningResult.cohortName ?? t('applicableCohort') }) : t('groupPlanFallback')}</p></div><Link href={`${planningBasePath}/${planningResult.resolution.planId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{t('viewPlanning')}</Link></div> : planningResult?.resolution.status === 'conflict' ? <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>{t('planningConflict')}</div> : <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{t('noActivePlanning')}</p>}</CardContent></Card>
        <Card className='md:col-span-2'><CardHeader><CardTitle className='flex items-center gap-2'><ShieldAlert className='size-5' />{t('emergencyContact')}</CardTitle></CardHeader><CardContent><dl className='grid gap-5 sm:grid-cols-2'><DetailItem label={t('contact')} value={athlete.emergencyContact} fallback={t('notProvided')} /><DetailItem label={t('phone')} value={athlete.emergencyPhone} fallback={t('notProvided')} /></dl></CardContent></Card>
      </div>
    </div>
  )
}
