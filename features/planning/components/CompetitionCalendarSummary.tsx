import type { CompetitionEntryWithDistanceCompatibility } from '@/lib/periodization/competition-distance-context'
import { Badge } from '@ui/badge'
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
        compatibility: 'H8 compatibility',
        primary: 'Main',
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
        compatibility: 'Compatibilidad H8',
        primary: 'Principal',
      }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
        {hasPrimaryConflict && (
          <p role='status' className='text-sm text-destructive'>{copy.conflict}</p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCompetitions.map((competition) => {
                const isPrimary = competition.id === primaryCompetitionId

                return (
                  <TableRow key={competition.id}>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Badge variant={competition.priority === 'A' ? 'default' : 'secondary'}>
                          {competition.priority}
                        </Badge>
                        {isPrimary && <Badge variant='outline'>{copy.primary}</Badge>}
                      </div>
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
