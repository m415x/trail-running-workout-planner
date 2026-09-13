'use client'

import { useState, useTransition } from 'react'
import { Pencil, XCircle } from 'lucide-react'

import {
  changeCompetitionStatusAction,
  updateCompetitionAction,
} from '@/app/actions/competition-calendar-actions'
import type { CompetitionEntryWithDistanceCompatibility } from '@/lib/periodization/competition-distance-context'
import type { CompetitionPriority } from '@/types/training/competition-entry.types'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

interface CompetitionCalendarSummaryProps {
  competitions: readonly CompetitionEntryWithDistanceCompatibility[]
  primaryCompetitionId: string | null
  locale: string
  hasPrimaryConflict?: boolean
}

const STATUS_LABELS = {
  es: {
    planned: 'Planificada',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
  },
  en: {
    planned: 'Planned',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
} as const

const COMPATIBILITY_LABELS = {
  es: {
    compatible: 'Compatible',
    incompatible: 'Fuera de rango',
    unrestricted: 'Sin restricción',
    policy_not_defined: 'Política pendiente',
    not_applicable: 'No aplica',
    invalid: 'Datos inválidos',
  },
  en: {
    compatible: 'Compatible',
    incompatible: 'Outside range',
    unrestricted: 'Unrestricted',
    policy_not_defined: 'Policy pending',
    not_applicable: 'Not applicable',
    invalid: 'Invalid data',
  },
} as const

export function CompetitionCalendarSummary({
  competitions,
  primaryCompetitionId,
  locale,
  hasPrimaryConflict = false,
}: CompetitionCalendarSummaryProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [priority, setPriority] = useState<CompetitionPriority>('C')
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (competitions.length === 0) return null

  const language = locale === 'en' ? 'en' : 'es'
  const statusLabels = STATUS_LABELS[language]
  const compatibilityLabels = COMPATIBILITY_LABELS[language]
  const dateLocale = language === 'en' ? 'en-US' : 'es-AR'
  const sortedCompetitions = [...competitions].sort((first, second) => (
    first.date.localeCompare(second.date)
  ))
  const copy = language === 'en'
    ? {
        title: 'Competition calendar',
        description: 'Live competition context used by the plan. Priority A identifies the main objective when there is a single active candidate.',
        conflict: 'There is more than one active priority A competition. Planning cannot determine a single main competition.',
        priority: 'Priority',
        competition: 'Competition',
        date: 'Date',
        distance: 'Distance',
        elevation: 'Elevation',
        status: 'Status',
        compatibility: 'Category/distance compatibility',
        primary: 'Main',
        actions: 'Actions',
        edit: 'Edit',
        save: 'Save',
        cancelEdit: 'Cancel edit',
        cancelCompetition: 'Cancel competition',
        actionError: 'The competition could not be updated. Review the calendar rules and try again.',
      }
    : {
        title: 'Calendario competitivo',
        description: 'Contexto competitivo vivo utilizado por la planificación. La prioridad A identifica el objetivo principal cuando existe un único candidato activo.',
        conflict: 'Hay más de una competencia A activa. La planificación no puede determinar una única competencia principal.',
        priority: 'Prioridad',
        competition: 'Competencia',
        date: 'Fecha',
        distance: 'Distancia',
        elevation: 'Desnivel',
        status: 'Estado',
        compatibility: 'Compatibilidad categoría/distancia',
        primary: 'Principal',
        actions: 'Acciones',
        edit: 'Editar',
        save: 'Guardar',
        cancelEdit: 'Cancelar edición',
        cancelCompetition: 'Cancelar competencia',
        actionError: 'No se pudo actualizar la competencia. Revisá las reglas del calendario e intentá nuevamente.',
      }

  function beginEdit(competition: CompetitionEntryWithDistanceCompatibility) {
    setActionError(null)
    setEditingId(competition.id)
    setPriority(competition.priority)
  }

  function savePriority(competition: CompetitionEntryWithDistanceCompatibility) {
    setActionError(null)
    startTransition(async () => {
      const result = await updateCompetitionAction({
        planId: competition.groupTrainingPlanId,
        competitionId: competition.id,
        locale: language,
        draft: {
          name: competition.name,
          date: competition.date,
          distanceKm: competition.distanceKm,
          elevationGainM: competition.elevationGainM ?? null,
          priority,
          description: competition.description ?? null,
        },
      })

      if (!result.ok) {
        setActionError(copy.actionError)
        return
      }

      setEditingId(null)
    })
  }

  function cancelCompetition(competition: CompetitionEntryWithDistanceCompatibility) {
    setActionError(null)
    startTransition(async () => {
      const result = await changeCompetitionStatusAction({
        planId: competition.groupTrainingPlanId,
        competitionId: competition.id,
        locale: language,
        status: 'cancelled',
      })

      if (!result.ok) setActionError(copy.actionError)
      else setEditingId(null)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
        {hasPrimaryConflict && (
          <p role='status' className='text-sm text-destructive'>{copy.conflict}</p>
        )}
        {actionError && (
          <p role='alert' className='text-sm text-destructive'>{actionError}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.priority}</TableHead>
                <TableHead>{copy.competition}</TableHead>
                <TableHead>{copy.date}</TableHead>
                <TableHead>{copy.distance}</TableHead>
                <TableHead>{copy.elevation}</TableHead>
                <TableHead>{copy.status}</TableHead>
                <TableHead>{copy.compatibility}</TableHead>
                <TableHead className='text-right'>{copy.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCompetitions.map((competition) => {
                const isPrimary = competition.id === primaryCompetitionId
                const isEditing = editingId === competition.id

                return (
                  <TableRow key={competition.id}>
                    <TableCell>
                      {isEditing ? (
                        <select
                          aria-label={copy.priority}
                          value={priority}
                          onChange={(event) => setPriority(event.target.value as CompetitionPriority)}
                          disabled={pending}
                          className='h-8 rounded-md border border-input bg-background px-2 text-sm'
                        >
                          <option value='A'>A</option>
                          <option value='B'>B</option>
                          <option value='C'>C</option>
                        </select>
                      ) : (
                        <div className='flex items-center gap-2'>
                          <Badge variant={competition.priority === 'A' ? 'default' : 'secondary'}>
                            {competition.priority}
                          </Badge>
                          {isPrimary && <Badge variant='outline'>{copy.primary}</Badge>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='font-medium'>{competition.name}</TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat(dateLocale, { timeZone: 'UTC' }).format(
                        new Date(`${competition.date}T00:00:00Z`),
                      )}
                    </TableCell>
                    <TableCell>{competition.distanceKm.toLocaleString(dateLocale)} km</TableCell>
                    <TableCell>
                      {competition.elevationGainM === null || competition.elevationGainM === undefined
                        ? '—'
                        : `+${competition.elevationGainM.toLocaleString(dateLocale)} m`}
                    </TableCell>
                    <TableCell>{statusLabels[competition.status]}</TableCell>
                    <TableCell>
                      <Badge variant={competition.distanceCompatibility.status === 'incompatible' || competition.distanceCompatibility.status === 'invalid' ? 'destructive' : 'outline'}>
                        {compatibilityLabels[competition.distanceCompatibility.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-end gap-2'>
                        {isEditing ? (
                          <>
                            <Button type='button' size='sm' disabled={pending} onClick={() => savePriority(competition)}>
                              {copy.save}
                            </Button>
                            <Button type='button' variant='outline' size='sm' disabled={pending} onClick={() => setEditingId(null)}>
                              {copy.cancelEdit}
                            </Button>
                          </>
                        ) : (
                          <>
                            {competition.status !== 'cancelled' && competition.status !== 'completed' && (
                              <Button type='button' variant='outline' size='sm' disabled={pending} onClick={() => beginEdit(competition)}>
                                <Pencil /> {copy.edit}
                              </Button>
                            )}
                            {competition.status !== 'cancelled' && competition.status !== 'completed' && (
                              <Button type='button' variant='ghost' size='sm' disabled={pending} onClick={() => cancelCompetition(competition)}>
                                <XCircle /> {copy.cancelCompetition}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
