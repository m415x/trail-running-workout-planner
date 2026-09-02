import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye, Pencil, UsersRound } from 'lucide-react'

import { getGroupWithMembers } from '@/app/actions/group-actions'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

interface GroupDetailPageProps {
  params: Promise<{ locale: string; groupId: string }>
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { locale, groupId } = await params
  const group = await getGroupWithMembers(groupId)

  if (!group) {
    notFound()
  }

  const groupsPath = locale === 'es' ? '/dashboard/groups' : `/${locale}/dashboard/groups`
  const athletesPath = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  const groupCode = `${group.categoryCode}${group.levelCode}`
  const activeMembers = group.athletes.filter((athlete) => athlete.isActive).length

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-start gap-3'>
          <Link
            href={groupsPath}
            aria-label='Volver al listado de grupos'
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <ArrowLeft />
          </Link>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='text-3xl font-bold tracking-tight'>Grupo {groupCode}</h2>
              <Badge variant={group.isActive ? 'default' : 'secondary'}>
                {group.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className='text-muted-foreground'>{group.description || 'Sin descripción'}</p>
          </div>
        </div>

        <Link href={`${groupsPath}/${group.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
          <Pencil /> Editar grupo
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <UsersRound className='size-5' />
            Integrantes
          </CardTitle>
          <CardDescription>
            {group.athletes.length === 0
              ? 'Este grupo todavía no tiene atletas asignados.'
              : `${group.athletes.length} ${group.athletes.length === 1 ? 'atleta asignado' : 'atletas asignados'} · ${activeMembers} ${activeMembers === 1 ? 'activo' : 'activos'}`}
          </CardDescription>
        </CardHeader>

        {group.athletes.length > 0 && (
          <CardContent>
            <div className='overflow-hidden rounded-lg border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className='w-16'><span className='sr-only'>Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.athletes.map((athlete) => {
                    const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`
                    const athletePath = `${athletesPath}/${athlete.id}`

                    return (
                      <TableRow key={athlete.id} className={!athlete.isActive ? 'opacity-60' : undefined}>
                        <TableCell>
                          <div className='flex items-center gap-3'>
                            <Avatar className='size-9'>
                              <AvatarImage src={athlete.user.avatar ?? undefined} alt={fullName} />
                              <AvatarFallback>{getInitials(athlete.user.firstName, athlete.user.lastName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <Link href={athletePath} className='font-medium hover:underline'>{fullName}</Link>
                              {athlete.nickName && <p className='text-xs text-muted-foreground'>“{athlete.nickName}”</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p>{athlete.user.email}</p>
                          {athlete.phone && <p className='text-xs text-muted-foreground'>{athlete.phone}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant='outline'
                            className={athlete.isActive ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}
                          >
                            {athlete.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={athletePath}
                            aria-label={`Ver detalle de ${fullName}`}
                            title='Ver atleta'
                            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                          >
                            <Eye />
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
