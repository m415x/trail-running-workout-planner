import Link from 'next/link'
import { Pencil } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

import type { AthleteCategoryCode, AthleteLevelCode } from '@/types'

export interface AthleteListItem {
  id: string
  phone: string | null
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
  return (
    <Card className='overflow-hidden py-0'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atleta</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className='w-16'><span className='sr-only'>Acciones</span></TableHead>
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

            return (
              <TableRow key={athlete.id}>
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
                  <Badge variant='outline' className='border-emerald-500/40 text-emerald-700 dark:text-emerald-400'>
                    Activo
                  </Badge>
                </TableCell>

                <TableCell>
                  <Link
                    href={editPath}
                    aria-label={`Editar ${fullName}`}
                    className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                  >
                    <Pencil />
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
