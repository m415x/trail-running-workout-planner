import { Users } from 'lucide-react'

import { Card, CardContent } from '@ui/card'

export function AthletesEmptyState() {
  return (
    <Card>
      <CardContent className='flex min-h-64 flex-col items-center justify-center gap-3 text-center'>
        <div className='flex size-12 items-center justify-center rounded-full bg-muted'>
          <Users className='size-6 text-muted-foreground' />
        </div>
        <div className='space-y-1'>
          <h3 className='font-semibold'>Todavía no hay atletas</h3>
          <p className='max-w-sm text-sm text-muted-foreground'>
            Cuando se agreguen perfiles activos al equipo aparecerán en este listado.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
