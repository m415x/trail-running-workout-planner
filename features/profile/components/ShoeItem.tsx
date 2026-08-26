import { ShoeItemProps } from '@/types'
import ProgressGradient from '@ui/custom/progress-gradient'

export function ShoeItem({ name, type, km, maxKm, status }: ShoeItemProps) {
  const percentage = Math.min(100, Math.round((km / maxKm) * 100))

  return (
    <div className='p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-2'>
      <div className='flex justify-between items-start'>
        <div>
          <p className='font-heading font-bold text-xs text-foreground'>{name}</p>
          <p className='text-[10px] text-muted-foreground'>{type}</p>
        </div>
        <span className='text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary font-semibold text-secondary-foreground'>
          {km} / {maxKm} km
        </span>
      </div>

      <div className='space-y-1'>
        <div className='h-1.5 w-full bg-muted rounded-full overflow-hidden'>
          <ProgressGradient value={percentage} />
        </div>
        <div className='flex justify-between text-[9px] text-muted-foreground'>
          <span>{status}</span>
          <span>{percentage}% usado</span>
        </div>
      </div>
    </div>
  )
}
