import { MapPin } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import type { WorkoutType } from '@/types/training/workout.types'
import { Badge } from '@ui/badge'

export interface CalendarSession {
  id: string
  date: string
  title: string
  type: WorkoutType
  notes: string | null
  location: { name: string } | null
}

interface SessionCalendarCardProps {
  session: CalendarSession
  href: string
  compact?: boolean
}

export function SessionCalendarCard({ session, href, compact = false }: SessionCalendarCardProps) {
  const workoutTypeT = useTranslations('Workouts')

  return (
    <Link href={href} className='block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
      <article className={cn('min-w-0 space-y-2 rounded-md border bg-background p-2.5 shadow-xs transition-colors hover:border-primary/50 hover:bg-accent/40', compact && 'space-y-1 p-2')}>
        <div className={cn('flex min-w-0 flex-col items-start gap-1.5')}>
          <p className={cn('font-semibold leading-snug min-w-0 break-words [overflow-wrap:anywhere]', compact ? 'line-clamp-2 text-xs' : 'text-sm')}>
            {session.title}
          </p>
          <Badge variant='secondary' className={cn('max-w-full self-start whitespace-normal break-words text-left [overflow-wrap:anywhere]', compact ? 'px-1.5 py-0 text-[10px]' : 'text-[10px]')}>
            {workoutTypeT(`types.${session.type}`)}
          </Badge>
        </div>

        {session.location && (
          <p className={cn('flex min-w-0 items-center gap-1 text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
            <MapPin className='size-3 shrink-0' />
            <span className='line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]'>{session.location.name}</span>
          </p>
        )}

        {session.notes && (
          <p className={cn('line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere] text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
            {session.notes}
          </p>
        )}
      </article>
    </Link>
  )
}
