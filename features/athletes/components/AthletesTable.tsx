'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil, Power } from 'lucide-react'

import { setAthleteActiveState } from '@/app/actions/athlete-actions'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { Badge } from '@ui/badge'
import { Button, buttonVariants } from '@ui/button'
import { Card } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

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
}

interface AthletesTableProps {
  athletes: AthleteListItem[]
  locale: string
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function AthletesTable({ athletes, locale }: AthletesTableProps) {
  const [error, setError] = useState<string | null>(null)
  const [pendingAthleteId, setPendingAthleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleActiveState(athlete: AthleteListItem) {
    setError(null)
    setPendingAthleteId(athlete.id)

    startTransition(async () => {
      const result = await setAthleteActiveState(athlete.id, !athlete.isActive, locale)

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
              <TableHead>Grupo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className='w-28'><span className='sr-only'>Acciones</span></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {athletes.map((athlete) => {
              const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`
              const groupCode = athlete.group
                ? `${athlete.group.categoryCode}${athlete.group.levelCode}`
                : null
              const editPath = locale === 'es'
                ? `/dashboard/athletes/${athlete.id}/edit`
                : `/${locale}/dashboard/athletes/${athlete.id}/edit`
              const isChangingState = isPending && pendingAthleteId === athlete.id

              return (
                <TableRow key={athlete.id} className={!athlete.isActive ? 'opacity-60' : undefined}>
                  <TableCell>
                    <div className='flex items-center gap-3'>
                      <Avatar className='size-9'>
                        <AvatarImage src={athlete.user.avatar ?? undefined} alt={fullName} />
                        <AvatarFallback>{getInitials(athlete.user.firstName, athlete.user.lastName)}</AvatarFallback>
                      </Avatar>
                      <span className='font-medium'>{fullName}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className='space-y-0.5'>
                      <p>{athlete.user.email}</p>
                      {athlete.phone && <p className='text-xs text-muted-foreground'>{athlete.phone}</p>}
                    </div>
                  </TableCell>

                  <TableCell>
                    {groupCode ? <Badge variant='secondary'>{groupCode}</Badge> : <Badge variant='outline'>Sin grupo</Badge>}
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

                  <TableCell>
                    <div className='flex justify-end gap-1'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        disabled={isChangingState}
                        aria-label={`${athlete.isActive ? 'Desactivar' : 'Activar'} ${fullName}`}
                        title={athlete.isActive ? 'Desactivar atleta' : 'Activar atleta'}
                        onClick={() => toggleActiveState(athlete)}
                      >
                        <Power />
                      </Button>

                      <Link
                        href={editPath}
                        aria-label={`Editar ${fullName}`}
                        className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                      >
                        <Pencil />
                      </Link>
                    </div>
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
