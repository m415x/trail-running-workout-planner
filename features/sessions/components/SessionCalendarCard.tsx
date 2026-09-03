import { MapPin } from 'lucide-react'
import Link from 'next/link'

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
  return (
    <Link href={href} className='block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
      <article className={cn('space-y-2 rounded-md border bg-background p-2.5 shadow-xs transition-colors hover:border-primary/50 hover:bg-accent/40', compact && 'space-y-1 p-2')}>
        <div className='flex items-start justify-between gap-2'>
          <p className={cn('font-semibold leading-snug', compact ? 'line-clamp-2 text-xs' : 'text-sm')}>
            {session.title}
          </p>
          <Badge variant='secondary' className={cn('shrink-0', compact ? 'px-1.5 py-0 text-[10px]' : 'text-[10px]')}>
            {session.type}
          </Badge>
        </div>

        {session.location && (
          <p className={cn('flex items-center gap-1 text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
            <MapPin className='size-3 shrink-0' />
            <span className={compact ? 'truncate' : 'line-clamp-2'}>{session.location.name}</span>
          </p>
        )}

        {session.notes && (
          <p className={cn('line-clamp-2 text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
            {session.notes}
          </p>
        )}
      </article>
    </Link>
  )
}
