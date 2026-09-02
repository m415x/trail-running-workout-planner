import { Skeleton } from '@ui/skeleton'

export default function AthletesLoading() {
  return (
    <div className='space-y-6' aria-label='Cargando atletas' aria-busy='true'>
      <div className='space-y-2'>
        <Skeleton className='h-9 w-40' />
        <Skeleton className='h-5 w-full max-w-md' />
      </div>

      <div className='overflow-hidden rounded-xl border'>
        <div className='grid grid-cols-4 gap-4 border-b bg-muted/40 p-4'>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className='h-4 w-24' />
          ))}
        </div>

        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className='grid grid-cols-4 items-center gap-4 border-b p-4 last:border-b-0'>
            <div className='flex items-center gap-3'>
              <Skeleton className='size-9 rounded-full' />
              <Skeleton className='h-4 w-32' />
            </div>
            <Skeleton className='h-4 w-40' />
            <Skeleton className='h-6 w-20 rounded-full' />
            <Skeleton className='h-4 w-24' />
          </div>
        ))}
      </div>
    </div>
  )
}
