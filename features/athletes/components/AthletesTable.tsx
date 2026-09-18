'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { EllipsisVertical, Eye, Pencil, Power, UsersRound } from 'lucide-react'

import { setAthleteActiveState } from '@/app/actions/athlete-actions'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Card } from '@ui/card'
import { ConfirmActionDialog } from '@ui/custom/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

import {
  requiresAthleteActiveStateConfirmation,
  targetAthleteActiveState,
} from '@/features/athletes/lib/athlete-active-state-confirmation'

import type { AthleteCategoryCode, AthleteLevelCode } from '@/types'

export interface AthleteListItem {
  id: string
  phone: string | null
  isActive: boolean
  user: {
    firstName: string
    lastName: string
    email: string
    avatar: string | null
  }
  group: {
    categoryCode: AthleteCategoryCode
    levelCode: AthleteLevelCode
  } | null
  currentPlanningCohort: { id: string; name: string } | null
  hasPlanningCohortConflict: boolean
}

interface AthletesTableProps {
  athletes: AthleteListItem[]
  locale: string
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function AthletesTable({ athletes, locale }: AthletesTableProps) {
  const t = useTranslations('AthleteActions')
  const [error, setError] = useState<string | null>(null)
  const [pendingAthleteId, setPendingAthleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleActiveState(athlete: AthleteListItem) {
    setError(null)
    setPendingAthleteId(athlete.id)

    startTransition(async () => {
      const result = await setAthleteActiveState(athlete.id, targetAthleteActiveState(athlete.isActive), locale)

      if (!result.success) {
        setError(result.error)
      }

      setPendingAthleteId(null)
    })
  }

  return (
    <div className='space-y-3'>
      {error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      <Card className='overflow-hidden py-0'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atleta</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Grupo / cohorte</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className='w-16'><span className='sr-only'>{t('actions')}</span></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {athletes.map((athlete) => {
              const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`
              const groupCode = athlete.group
                ? `${athlete.group.categoryCode}${athlete.group.levelCode}`
                : null
              const basePath = locale === 'es'
                ? `/dashboard/athletes/${athlete.id}`
                : `/${locale}/dashboard/athletes/${athlete.id}`
              const editPath = `${basePath}/edit`
              const groupPath = `${basePath}/group`
              const cohortPath = athlete.currentPlanningCohort
                ? (locale === 'es'
                    ? `/dashboard/cohorts/${athlete.currentPlanningCohort.id}`
                    : `/${locale}/dashboard/cohorts/${athlete.currentPlanningCohort.id}`)
                : null
              const isChangingState = isPending && pendingAthleteId === athlete.id

              return (
                <TableRow key={athlete.id} className={!athlete.isActive ? 'opacity-60' : undefined}>
                  <TableCell>
                    <div className='flex items-center gap-3'>
                      <Avatar className='size-9'>
                        <AvatarImage src={athlete.user.avatar ?? undefined} alt={fullName} />
                        <AvatarFallback>{getInitials(athlete.user.firstName, athlete.user.lastName)}</AvatarFallback>
                      </Avatar>
                      <Link href={basePath} className='font-medium hover:underline'>
                        {fullName}
                      </Link>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className='space-y-0.5'>
                      <p>{athlete.user.email}</p>
                      {athlete.phone && <p className='text-xs text-muted-foreground'>{athlete.phone}</p>}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className='flex flex-col items-start gap-1'>
                      {groupCode ? <Badge variant='secondary'>{groupCode}</Badge> : <Badge variant='outline'>Sin grupo</Badge>}
                      {athlete.hasPlanningCohortConflict ? (
                        <span className='text-xs font-medium text-destructive'>Conflicto de cohortes</span>
                      ) : athlete.currentPlanningCohort && cohortPath ? (
                        <Link href={cohortPath} className='max-w-48 truncate text-xs text-muted-foreground hover:text-foreground hover:underline'>
                          {athlete.currentPlanningCohort.name}
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    {athlete.isActive ? (
                      <Badge variant='outline' className='border-emerald-500/40 text-emerald-700 dark:text-emerald-400'>
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant='outline' className='text-muted-foreground'>
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className='text-right'>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={(
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            aria-label={t('menuFor', { name: fullName })}
                          />
                        )}
                      >
                        <EllipsisVertical />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end' className='w-52'>
                        <DropdownMenuItem render={<Link href={basePath} />}>
                          <Eye />
                          {t('viewDetail')}
                        </DropdownMenuItem>
                        {requiresAthleteActiveStateConfirmation(athlete.isActive) ? (
                          <ConfirmActionDialog
                            title={t('deactivateConfirmTitle')}
                            description={t('deactivateConfirmDescription')}
                            confirmLabel={t('deactivateConfirmAction')}
                            cancelLabel={t('deactivateConfirmCancel')}
                            variant='destructive'
                            onConfirm={() => toggleActiveState(athlete)}
                            trigger={(openDialog) => (
                              <DropdownMenuItem
                                variant='destructive'
                                disabled={isChangingState}
                                onClick={() => {
                                  openDialog()
                                }}
                              >
                                <Power />
                                {t('deactivate')}
                              </DropdownMenuItem>
                            )}
                          />
                        ) : (
                          <DropdownMenuItem
                            disabled={isChangingState}
                            onClick={() => toggleActiveState(athlete)}
                          >
                            <Power />
                            {t('activate')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem render={<Link href={groupPath} />}>
                          <UsersRound />
                          {groupCode ? t('changeGroup') : t('assignGroup')}
                        </DropdownMenuItem>
                        <DropdownMenuItem render={<Link href={editPath} />}>
                          <Pencil />
                          {t('editAthlete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
