import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarRange, Eye, LogOut, Pencil, UserPlus, UsersRound } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getPlanningCohortDetail } from '@/app/actions/planning-cohort-actions'
import { classifyPlanningCohortMembership } from '@/lib/planning-cohorts/membership-view'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

interface PlanningCohortDetailPageProps {
  params: Promise<{ locale: string; cohortId: string }>
}

type CohortMembership = NonNullable<Awaited<ReturnType<typeof getPlanningCohortDetail>>>['memberships'][number]

interface MembershipLabels {
  athlete: string
  period: string
  reason: string
  actions: string
  noEndDate: string
  untilDate: (date: string) => string
  noAssignmentReason: string
  closeReason: (reason: string) => string
  viewAthlete: (name: string) => string
  removeAthlete: (name: string) => string
}

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function MembershipTable({
  memberships,
  athletesPath,
  cohortPath,
  allowClose,
  labels,
}: {
  memberships: CohortMembership[]
  athletesPath: string
  cohortPath: string
  allowClose: boolean
  labels: MembershipLabels
}) {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{labels.athlete}</TableHead>
            <TableHead>{labels.period}</TableHead>
            <TableHead>{labels.reason}</TableHead>
            <TableHead className='w-28'><span className='sr-only'>{labels.actions}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memberships.map((membership) => {
            const athlete = membership.athleteProfile
            const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`

            return (
              <TableRow key={membership.id}>
                <TableCell>
                  <p className='font-medium'>{fullName}</p>
                  {athlete.nickName && <p className='text-xs text-muted-foreground'>“{athlete.nickName}”</p>}
                </TableCell>
                <TableCell>
                  <p>{formatDate(membership.startDate)}</p>
                  <p className='text-xs text-muted-foreground'>
                    {membership.endDate === null
                      ? labels.noEndDate
                      : labels.untilDate(formatDate(membership.endDate))}
                  </p>
                </TableCell>
                <TableCell className='max-w-72'>
                  <p className='truncate'>{membership.assignmentReason ?? labels.noAssignmentReason}</p>
                  {membership.endReason && (
                    <p className='truncate text-xs text-muted-foreground'>
                      {labels.closeReason(membership.endReason)}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-1'>
                    <Link
                      href={`${athletesPath}/${athlete.id}`}
                      aria-label={labels.viewAthlete(fullName)}
                      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                    >
                      <Eye />
                    </Link>
                    {allowClose && membership.endDate === null && (
                      <Link
                        href={`${cohortPath}/members/${membership.id}/close`}
                        aria-label={labels.removeAthlete(fullName)}
                        className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                      >
                        <LogOut />
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function PlanningCohortDetailPage({ params }: PlanningCohortDetailPageProps) {
  const { locale, cohortId } = await params
  const t = await getTranslations({ locale, namespace: 'CoachPlanningAudience.planningSubgroups' })
  const cohort = await getPlanningCohortDetail(cohortId)

  if (!cohort) {
    notFound()
  }

  const cohortsPath = locale === 'es' ? '/dashboard/cohorts' : `/${locale}/dashboard/cohorts`
  const athletesPath = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  const groupCode = `${cohort.group.categoryCode}${cohort.group.levelCode}`
  const today = todayInArgentina()
  const cohortPath = `${cohortsPath}/${cohort.id}`
  const currentMemberships = cohort.memberships.filter((membership) => classifyPlanningCohortMembership(membership, today) === 'current')
  const scheduledMemberships = cohort.memberships.filter((membership) => classifyPlanningCohortMembership(membership, today) === 'scheduled')
  const historicalMemberships = cohort.memberships.filter((membership) => classifyPlanningCohortMembership(membership, today) === 'historical')
  const labels: MembershipLabels = {
    athlete: t('athlete'),
    period: t('period'),
    reason: t('reason'),
    actions: t('actions'),
    noEndDate: t('noEndDate'),
    untilDate: (date) => t('untilDate', { date }),
    noAssignmentReason: t('noAssignmentReason'),
    closeReason: (reason) => t('closeReason', { reason }),
    viewAthlete: (name) => t('viewAthlete', { name }),
    removeAthlete: (name) => t('removeAthlete', { name }),
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-start gap-3'>
        <Link
          href={cohortsPath}
          aria-label={t('backAria')}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ArrowLeft />
        </Link>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-3xl font-bold tracking-tight'>{cohort.name}</h2>
            <Badge variant={cohort.status === 'active' ? 'default' : 'secondary'}>
              {cohort.status === 'active' ? t('active') : t('archived')}
            </Badge>
            <Badge variant='outline'>{t('sportingGroup')} {groupCode}</Badge>
          </div>
          <p className='text-muted-foreground'>{cohort.purpose}</p>
          {cohort.description && <p className='mt-2 max-w-3xl text-sm'>{cohort.description}</p>}
        </div>
        <Link href={`${cohortsPath}/${cohort.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
          <Pencil /> {cohort.status === 'active' ? t('edit') : t('viewArchive')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CalendarRange className='size-5' />
            {t('variantTitle')}
          </CardTitle>
          <CardDescription>{t('variantDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {cohort.planningVariant ? (
            <div className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <p className='font-medium'>{cohort.planningVariant.title}</p>
                <p className='text-sm text-muted-foreground'>
                  {t('statusLabel')}: {cohort.planningVariant.status} · {t('sourceLabel')}: {cohort.planningVariant.sourceGroupTrainingPlan?.title ?? t('unavailable')}
                </p>
              </div>
              <Link
                href={`${planningPath}/${cohort.planningVariant.id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Eye /> {t('openPlanning')}
              </Link>
            </div>
          ) : (
            <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
              {t('noVariantDescription')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'><UsersRound className='size-5' /> {t('currentMembers')}</CardTitle>
              <CardDescription>
                {currentMemberships.length === 0
                  ? t('currentMembersEmpty')
                  : t('currentMembersCount', { count: currentMemberships.length })}
              </CardDescription>
            </div>
            {cohort.status === 'active' && (
              <Link href={`${cohortPath}/members/new`} className={buttonVariants({ size: 'sm' })}>
                <UserPlus /> {t('assignAthlete')}
              </Link>
            )}
          </div>
        </CardHeader>
        {currentMemberships.length > 0 && (
          <CardContent>
            <MembershipTable
              memberships={currentMemberships}
              athletesPath={athletesPath}
              cohortPath={cohortPath}
              allowClose={cohort.status === 'active'}
              labels={labels}
            />
          </CardContent>
        )}
      </Card>

      {scheduledMemberships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('upcomingMembers')} <Badge variant='outline'>{scheduledMemberships.length}</Badge></CardTitle>
            <CardDescription>{t('upcomingMembersDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <MembershipTable
              memberships={scheduledMemberships}
              athletesPath={athletesPath}
              cohortPath={cohortPath}
              allowClose={cohort.status === 'active'}
              labels={labels}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('membershipHistory')} <Badge variant='secondary'>{historicalMemberships.length}</Badge></CardTitle>
          <CardDescription>{t('membershipHistoryDescription')}</CardDescription>
        </CardHeader>
        {historicalMemberships.length > 0 ? (
          <CardContent>
            <MembershipTable
              memberships={historicalMemberships}
              athletesPath={athletesPath}
              cohortPath={cohortPath}
              allowClose={false}
              labels={labels}
            />
          </CardContent>
        ) : (
          <CardContent><p className='text-sm text-muted-foreground'>{t('noMembershipHistory')}</p></CardContent>
        )}
      </Card>
    </div>
  )
}
